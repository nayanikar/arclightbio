import type { OpportunityObject } from "@/types/OpportunityObject";
import type { TargetDiseaseAssociation } from "@/types/api";
import { callAgentJson } from "@/api/anthropic";
import { getTargetDiseaseAssociations } from "@/api/openTargets";
import { insertEvidenceCard } from "@/lib/db";
import { computeCompositeQuality } from "@/lib/scoring";
import { extractKeywords } from "@/lib/hypothesis";
import { ApiError } from "@/lib/http";
import {
  computeDruggabilityComposite,
  formatTargetList,
  type RankedTarget,
} from "@/lib/targetList";
import { DOMAIN_CONTEXT_ADJUSTMENTS } from "@/lib/domainContext";
import { filterFailed, filterOk, type FilterResult } from "@/lib/filterResult";

const MECHANISM_FILTER_SYSTEM = `You are the Mechanism Agent for Opportunity Space, built by Arclight Bio.
Review Open Targets target–disease associations for mechanistic relevance to a biomedical hypothesis.
In relevance_reason, use gene symbols for targets and precise intervention language (inhibitor, agonist, modulator) when discussing therapeutics — never write that a target alone is approved.
Respond with valid JSON only — a JSON array.`;

const DRUGGABILITY_SYSTEM = `You are a drug discovery scientist evaluating targets for first-in-class therapeutic development.
In rationale and recommended_modality, use standard modality terms (small molecule, monoclonal antibody, ADC, siRNA) and pair targets with intervention class.
Return valid JSON only — a JSON array of ranked targets.`;

interface FilteredAssociation {
  target: string;
  disease: string;
  score: number;
  relevance_reason: string;
}

const NO_PATHWAY_OVERLAP_MESSAGE =
  "No direct pathway overlap identified for this hypothesis in Open Targets — mechanism connection requires further investigation.";

const LOW_RELEVANCE_QUALITY = {
  sample_size: 0.3,
  study_design: 0.3,
  source_credibility: 0.3,
  replication: 0.3,
  recency: 0.3,
  composite: 0.3,
};

async function filterRelevantAssociations(
  hypothesis: OpportunityObject["hypothesis"],
  associations: TargetDiseaseAssociation[]
): Promise<FilterResult<FilteredAssociation>> {
  const associationsJson = JSON.stringify(
    associations.map((a) => ({
      target: a.targetName,
      targetId: a.targetId,
      disease: a.diseaseName,
      diseaseId: a.diseaseId,
      score: a.score,
    }))
  );

  const userPrompt = `You are reviewing pathway associations returned by Open Targets for a specific biomedical hypothesis. The hypothesis is: ${hypothesis.statement}

Here are the associations found: ${associationsJson}

For each association, answer: does this target/pathway connection genuinely support or contradict the hypothesis above?

Return only the associations that are directly relevant. If none are relevant, return an empty array. Do not include associations just because they mention a word in the hypothesis — the biological connection must be mechanistically meaningful.

Return as JSON array with fields: target, disease, score, relevance_reason`;

  try {
    const filtered = await callAgentJson<FilteredAssociation[]>(
      MECHANISM_FILTER_SYSTEM,
      userPrompt
    );
    if (!Array.isArray(filtered)) {
      return filterFailed("Mechanism relevance filter returned invalid response");
    }
    return filterOk(filtered);
  } catch {
    return filterFailed("Mechanism relevance filter unavailable");
  }
}

function findAssociation(
  associations: TargetDiseaseAssociation[],
  filtered: FilteredAssociation
): TargetDiseaseAssociation | undefined {
  return (
    associations.find(
      (a) => a.targetName === filtered.target && a.diseaseName === filtered.disease
    ) ??
    associations.find((a) => a.targetName === filtered.target)
  );
}

function fallbackRankedTargets(relevant: FilteredAssociation[]): RankedTarget[] {
  return relevant.slice(0, 5).map((a, i) => {
    const scores = {
      structural_druggability: Math.min(0.9, 0.4 + a.score * 0.5),
      pathway_confidence: Math.min(0.95, a.score),
      clinical_novelty: 0.6,
      safety_precedent: 0.55,
    };
    return {
      target_name: a.target,
      gene_symbol: a.target.split(" ")[0] ?? a.target,
      ...scores,
      druggability_composite: computeDruggabilityComposite(scores),
      priority_rank: i + 1,
      rationale: a.relevance_reason,
      recommended_modality: "small molecule",
      key_risk: "Requires further validation of on-target safety in chronic use.",
    };
  });
}

async function scoreDruggability(
  obj: OpportunityObject,
  relevant: FilteredAssociation[]
): Promise<RankedTarget[]> {
  const domainContext = obj.domain_context ?? "general";
  const adjustments = DOMAIN_CONTEXT_ADJUSTMENTS[domainContext];
  const targetsJson = JSON.stringify(
    relevant.map((a) => ({
      target_name: a.target,
      disease: a.disease,
      association_score: a.score,
      relevance: a.relevance_reason,
    }))
  );

  const prompt = `For each target below, score druggability across four dimensions (0-1):

1. structural_druggability: binding pocket / prior drugging
2. pathway_confidence: validation in disease mechanism
3. clinical_novelty: absence of IND/patents in this indication (1.0 = no prior art)
4. safety_precedent: safety track record of modulating target

Targets: ${targetsJson}
Indication context: ${obj.hypothesis.patient_population}
Domain context: ${domainContext}
${adjustments?.target_filter ? `Target filter: ${adjustments.target_filter}` : ""}

Return ranked list, highest druggability_composite first:
[{
  "target_name": string,
  "gene_symbol": string,
  "structural_druggability": number,
  "pathway_confidence": number,
  "clinical_novelty": number,
  "safety_precedent": number,
  "druggability_composite": number,
  "priority_rank": integer,
  "rationale": string,
  "recommended_modality": string,
  "key_risk": string
}]`;

  try {
    const ranked = await callAgentJson<RankedTarget[]>(DRUGGABILITY_SYSTEM, prompt);
    if (!Array.isArray(ranked) || ranked.length === 0) {
      return fallbackRankedTargets(relevant);
    }
    return ranked
      .map((t, i) => ({
        ...t,
        priority_rank: t.priority_rank ?? i + 1,
        druggability_composite:
          t.druggability_composite ?? computeDruggabilityComposite(t),
      }))
      .sort((a, b) => a.priority_rank - b.priority_rank);
  } catch {
    return fallbackRankedTargets(relevant);
  }
}

export async function mechanismAgent(obj: OpportunityObject): Promise<void> {
  const { targets, conditions } = extractKeywords(
    obj.search_query ?? "",
    obj.hypothesis
  );
  const targetQuery = targets[0] ?? conditions[0] ?? obj.search_query ?? "TTR";

  let associations: Awaited<ReturnType<typeof getTargetDiseaseAssociations>> = [];
  let partial = false;

  try {
    associations = await getTargetDiseaseAssociations(targetQuery);
  } catch (err) {
    partial = true;
    if (!(err instanceof ApiError)) throw err;
  }

  if (associations.length === 0) {
    await insertEvidenceCard(obj.id, {
      content: partial
        ? `Mechanism search incomplete for target "${targetQuery}" — Open Targets API unavailable.`
        : `No Open Targets associations found for "${targetQuery}".`,
      source_url: "https://platform.opentargets.org/",
      source_type: "opentargets",
      contributing_agent: "mechanism",
      quality_scores: {
        sample_size: 0.4,
        study_design: 0.5,
        source_credibility: 0.6,
        replication: 0.3,
        recency: 0.7,
        composite: 0.45,
      },
      regulatory_weight: 0.45,
      raw_source_metadata: { targetQuery, partial, associations: [] },
    });
    return;
  }

  const filterResult = await filterRelevantAssociations(
    obj.hypothesis,
    associations
  );

  if (filterResult.status === "failed") {
    await insertEvidenceCard(obj.id, {
      content:
        "Mechanism relevance filter unavailable — Open Targets associations retrieved but not validated for this hypothesis." +
        (partial ? " [Partial search]" : ""),
      source_url: "https://platform.opentargets.org/",
      source_type: "opentargets",
      contributing_agent: "mechanism",
      quality_scores: LOW_RELEVANCE_QUALITY,
      regulatory_weight: 0.25,
      raw_source_metadata: {
        targetQuery,
        partial: true,
        filter_failed: true,
        associations: associations.slice(0, 15),
      },
    });
    return;
  }

  const relevant = filterResult.items;

  if (relevant.length === 0) {
    await insertEvidenceCard(obj.id, {
      content: NO_PATHWAY_OVERLAP_MESSAGE + (partial ? " [Partial search]" : ""),
      source_url: "https://platform.opentargets.org/",
      source_type: "opentargets",
      contributing_agent: "mechanism",
      quality_scores: LOW_RELEVANCE_QUALITY,
      regulatory_weight: 0.3,
      raw_source_metadata: {
        targetQuery,
        partial,
        associations: associations.slice(0, 15),
        filtered: [],
      },
    });
    return;
  }

  for (const assoc of relevant.slice(0, 3)) {
    const original = findAssociation(associations, assoc);
    const content = `${assoc.target}–${assoc.disease} association (Open Targets score: ${assoc.score.toFixed(2)}): ${assoc.relevance_reason}`;

    const quality = {
      sample_size: Math.min(1, relevant.length / 5),
      study_design: 0.8,
      source_credibility: 0.85,
      replication: assoc.score > 0.3 ? 0.75 : 0.5,
      recency: 0.85,
    };

    await insertEvidenceCard(obj.id, {
      content: content + (partial ? " [Partial search]" : ""),
      source_url: original
        ? `https://platform.opentargets.org/target/${original.targetId}`
        : "https://platform.opentargets.org/",
      source_type: "opentargets",
      contributing_agent: "mechanism",
      quality_scores: { ...quality, composite: computeCompositeQuality(quality) },
      regulatory_weight: computeCompositeQuality(quality),
      raw_source_metadata: {
        targetQuery,
        association: assoc,
        originalAssociation: original,
        partial,
      },
    });
  }

  const rankedTargets = await scoreDruggability(obj, relevant);
  if (rankedTargets.length > 0) {
    const topTarget = rankedTargets[0];
    const composite = topTarget.druggability_composite;

    await insertEvidenceCard(obj.id, {
      content: formatTargetList(rankedTargets),
      source_url: "https://platform.opentargets.org/",
      source_type: "opentargets",
      contributing_agent: "mechanism",
      is_target_list: true,
      quality_scores: {
        sample_size: 0.7,
        study_design: 0.75,
        source_credibility: 0.85,
        replication: 0.6,
        recency: 0.8,
        composite,
      },
      regulatory_weight: composite,
      raw_source_metadata: {
        ranked_targets: rankedTargets,
        targetQuery,
        partial,
        domain_context: obj.domain_context,
      },
    });
  }
}
