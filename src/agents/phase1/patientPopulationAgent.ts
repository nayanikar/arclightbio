import { callAgentJson } from "@/api/anthropic";
import type { OpportunityObject } from "@/types/OpportunityObject";
import type { PopulationDefinition } from "@/types/V3Pipeline";
import { updateOpportunityObject } from "@/lib/db";
import { updateV3OpportunityFields } from "@/lib/v3Db";
import {
  buildPhase1PromptHeader,
  formatCohortBlock,
  JSON_ONLY_SUFFIX,
  loadPhase1Context,
  resolveCohort,
  sanitizePopulation,
} from "./shared";

const SYSTEM = `You are the Patient Population Agent for Arclight Bio V3 Phase 1.
Define the target patient population from cohort data, user query, and parent domain.

The population definition must reflect query-defined inclusion criteria as primary (e.g. "without dominant oncogenic driver").
Loss-of-function biomarkers in the cohort are NOT required for inclusion unless the query explicitly requires LOF.
Return JSON:
{
  "definition": string (one falsifiable population definition sentence),
  "inclusion_criteria": string[],
  "exclusion_criteria": string[],
  "unmet_need": string,
  "cohort_summary": string,
  "estimated_prevalence": string (optional)
}${JSON_ONLY_SUFFIX}`;

export async function patientPopulationAgent(
  obj: OpportunityObject
): Promise<PopulationDefinition> {
  const ctx = await loadPhase1Context(obj);
  const cohort = await resolveCohort(ctx);

  let population: PopulationDefinition;
  try {
    population = await callAgentJson<PopulationDefinition>(
      SYSTEM,
      `${buildPhase1PromptHeader(ctx)}

${formatCohortBlock(cohort)}

Derive inclusion/exclusion from cohort biomarkers, diagnoses, and resistance_status where present.
Prioritize query-defined population criteria over cohort LOF patterns when defining inclusion.`
    );
  } catch {
    population = {
      definition: `Patients matching "${ctx.search_query ?? ctx.hypothesis.statement}" within ${ctx.parent_domain ?? "the selected"} parent domain.`,
      inclusion_criteria: [
        `Primary indication aligned with query: ${ctx.search_query ?? ctx.hypothesis.statement}`,
      ],
      exclusion_criteria: ["Insufficient cohort detail — refine with uploaded clinical data."],
      unmet_need: "Residual therapeutic failure or resistance in the defined population.",
      cohort_summary: cohort
        ? `${cohort.patient_count} patients uploaded; diagnoses span ${new Set(cohort.patients.map((p) => p.primary_diagnosis)).size} categories.`
        : "No cohort uploaded.",
    };
  }

  const sanitized = sanitizePopulation(population);
  await updateV3OpportunityFields(ctx.id, {
    population_definition: sanitized,
    v3_phase: "phase1:population",
  });
  await updateOpportunityObject(ctx.id, {
    hypothesis: {
      ...ctx.hypothesis,
      patient_population: sanitized.definition,
      unmet_need: sanitized.unmet_need,
    },
  });

  return sanitized;
}
