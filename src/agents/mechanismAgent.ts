import type { OpportunityObject } from "@/types/OpportunityObject";
import type { TargetDiseaseAssociation } from "@/types/api";
import { callAgentJson } from "@/api/anthropic";
import { getTargetDiseaseAssociations } from "@/api/openTargets";
import { insertEvidenceCard } from "@/lib/db";
import { computeCompositeQuality } from "@/lib/scoring";
import { extractKeywords } from "@/lib/hypothesis";
import { ApiError } from "@/lib/http";

const MECHANISM_FILTER_SYSTEM = `You are the Mechanism Agent for Opportunity Space, built by Arclight Bio.
Review Open Targets target–disease associations for mechanistic relevance to a biomedical hypothesis.
Respond with valid JSON only — a JSON array.`;

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
): Promise<FilteredAssociation[]> {
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
    return Array.isArray(filtered) ? filtered : [];
  } catch {
    return [];
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

  const relevant = await filterRelevantAssociations(obj.hypothesis, associations);

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

  for (const assoc of relevant) {
    const original = findAssociation(associations, assoc);
    const content = `${assoc.target} ↔ ${assoc.disease} (Open Targets score: ${assoc.score.toFixed(2)}): ${assoc.relevance_reason}`;

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
}
