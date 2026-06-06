import type { OpportunityObject } from "@/types/OpportunityObject";
import type {
  AnchorProfiles,
  CohortRecord,
  ExpertDomain,
  PopulationDefinition,
} from "@/types/V3Pipeline";
import { getCohortForOpportunity, loadV3Context } from "@/lib/v3Db";
import { parentDomainLabel } from "@/lib/parentDomains";
import { sanitizeScientificClaim } from "@/lib/scientificLanguage";
import { computeCompositeQuality } from "@/lib/scoring";
import {
  innovationPromptBlock,
  normalizeInnovationLevel,
} from "@/lib/innovationProfile";

export const JSON_ONLY_SUFFIX =
  "\n\nRespond with valid JSON only, no markdown fences. Use falsifiable subject–relationship–outcome sentences. Keep each string field to one short sentence (12–22 words).";

export async function loadPhase1Context(
  obj: OpportunityObject
): Promise<OpportunityObject> {
  return loadV3Context(obj);
}

export async function resolveCohort(
  obj: OpportunityObject
): Promise<CohortRecord | null> {
  return getCohortForOpportunity(obj.id, obj.cohort_id ?? undefined);
}

export function formatCohortBlock(cohort: CohortRecord | null): string {
  if (!cohort || cohort.patients.length === 0) {
    return "No cohort CSV uploaded — infer population from query and parent domain only.";
  }

  const sample = cohort.patients.slice(0, 20).map((p) => {
    const comorb = p.comorbidities.length ? p.comorbidities.join("; ") : "none";
    const biomarkers = p.biomarkers.length ? p.biomarkers.join("; ") : "none";
    return `${p.patient_id}: dx=${p.primary_diagnosis}; comorbidities=${comorb}; biomarkers=${biomarkers}; resistance=${p.resistance_status || "unknown"}`;
  });

  return `Cohort N=${cohort.patient_count}
Domain summary: ${cohort.domain_summary || "not computed"}
Sample patients:
${sample.join("\n")}`;
}

export function buildPhase1PromptHeader(obj: OpportunityObject): string {
  const pd = parentDomainLabel(obj.parent_domain ?? undefined);
  const query = obj.search_query ?? obj.hypothesis.statement;
  const level = normalizeInnovationLevel(obj.innovation_level);
  return `Query: "${query}"
Parent domain (PD): ${pd}
Program hypothesis: ${obj.program_hypothesis_sentence ?? "not yet defined"}
Population: ${obj.population_definition?.definition ?? obj.hypothesis.patient_population}
${innovationPromptBlock(level)}`;
}

export function formatAnchorBlock(anchors: AnchorProfiles | null | undefined): string {
  if (!anchors) return "Anchors not yet defined.";
  return `Biology anchor — population: ${anchors.biology.population}
Biology anchor statement: ${anchors.biology.anchor_statement}
Resistance anchor — population: ${anchors.resistance.population}
Resistance anchor statement: ${anchors.resistance.anchor_statement}`;
}

export function formatExpertDomains(domains: ExpertDomain[] | null | undefined): string {
  if (!domains?.length) return "No expert domains defined yet.";
  return domains
    .map(
      (d, i) =>
        `${i + 1}. ${d.domain} (${d.source}) — ${d.description ?? d.rationale ?? ""}${d.different_context ? ` [context: ${d.different_context}]` : ""}`
    )
    .join("\n");
}

export function defaultInternalQuality(partial = false) {
  const quality = {
    sample_size: 0.55,
    study_design: 0.65,
    source_credibility: 0.75,
    replication: 0.5,
    recency: 0.8,
  };
  const composite = computeCompositeQuality(quality) * (partial ? 0.85 : 1);
  return { ...quality, composite };
}

export function sanitizePopulation(def: PopulationDefinition): PopulationDefinition {
  return {
    ...def,
    definition: sanitizeScientificClaim(def.definition),
    unmet_need: sanitizeScientificClaim(def.unmet_need),
    cohort_summary: sanitizeScientificClaim(def.cohort_summary),
    inclusion_criteria: def.inclusion_criteria.map(sanitizeScientificClaim),
    exclusion_criteria: def.exclusion_criteria.map(sanitizeScientificClaim),
  };
}
