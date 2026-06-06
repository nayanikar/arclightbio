import { callAgentJson } from "@/api/anthropic";
import type { OpportunityObject } from "@/types/OpportunityObject";
import type { FalsificationExperiment } from "@/types/V3Pipeline";
import {
  listHypothesesByStage,
  updateV3Hypothesis,
  updateV3OpportunityFields,
} from "@/lib/v3Db";
import { sanitizeScientificClaim } from "@/lib/scientificLanguage";
import {
  buildPhase1PromptHeader,
  formatAnchorBlock,
  JSON_ONLY_SUFFIX,
  loadPhase1Context,
} from "./shared";
import { discoverySystemPrompt, narrativeTemperature } from "@/lib/innovationProfile";

const SYSTEM = `You are the Falsification Experiment Designer for Arclight Bio V3 Phase 1.
Design the shortest path experiment to DISPROVE the selectivity hypothesis.
When intervention direction is disputed, set direction_discrimination=true.
When anchor linkage may be lost, set reconnection_test=true.

Return JSON:
{
  "objective": string,
  "design": string,
  "primary_readout": string,
  "success_criteria": string,
  "failure_criteria": string,
  "estimated_timeline": string,
  "estimated_cost_range": string,
  "direction_discrimination": boolean,
  "reconnection_test": boolean
}${JSON_ONLY_SUFFIX}`;

export async function falsificationExperimentDesignerAgent(
  obj: OpportunityObject,
  hypothesisId?: string
): Promise<FalsificationExperiment | null> {
  const ctx = await loadPhase1Context(obj);
  const selectivity = await listHypothesesByStage(ctx.id, "selectivity");
  const hypothesis =
    selectivity.find((h) => h.id === hypothesisId) ??
    selectivity.find((h) => h.rank === 1) ??
    selectivity[0];

  if (!hypothesis) return null;

  let experiment: FalsificationExperiment;
  try {
    experiment = await callAgentJson<FalsificationExperiment>(
      discoverySystemPrompt(SYSTEM, ctx),
      `${buildPhase1PromptHeader(ctx)}
${formatAnchorBlock(ctx.anchor_profiles)}

Selectivity hypothesis: ${hypothesis.statement}
Falsifiability: ${hypothesis.falsifiability_statement}
Direction hypothesis: ${hypothesis.intervention_direction_hypothesis ?? "n/a"} (${hypothesis.direction_status ?? "unknown"})
Top target: ${hypothesis.ranked_targets?.[0]?.target_name ?? "not ranked"}
Mechanistic gaps: ${hypothesis.mechanistic_chain?.gaps?.join("; ") ?? "none"}`,
      { temperature: narrativeTemperature(ctx) }
    );
  } catch {
    experiment = {
      objective: `Test whether ${hypothesis.statement} can be falsified in ${hypothesis.patient_population}.`,
      design: "Controlled perturbation study in relevant preclinical model or ex vivo patient samples.",
      primary_readout: "Change in phenotype vs isotype/control after selective modulation.",
      success_criteria: "Observed phenotype shift consistent with causal hypothesis.",
      failure_criteria:
        "Selective modulation does not alter the predicted phenotype despite adequate target engagement.",
      estimated_timeline: "6–9 months",
      estimated_cost_range: "$250K–$500K",
      direction_discrimination: hypothesis.direction_status === "disputed",
      reconnection_test: Boolean(hypothesis.new_moa_requires_experiment),
    };
  }

  const falsification_experiment: FalsificationExperiment = {
    ...experiment,
    objective: sanitizeScientificClaim(experiment.objective ?? ""),
    design: sanitizeScientificClaim(experiment.design ?? ""),
    primary_readout: sanitizeScientificClaim(experiment.primary_readout ?? ""),
    success_criteria: sanitizeScientificClaim(experiment.success_criteria ?? ""),
    failure_criteria: sanitizeScientificClaim(experiment.failure_criteria ?? ""),
    estimated_timeline: sanitizeScientificClaim(experiment.estimated_timeline ?? ""),
    estimated_cost_range: experiment.estimated_cost_range
      ? sanitizeScientificClaim(experiment.estimated_cost_range)
      : undefined,
  };

  await updateV3Hypothesis(ctx.id, hypothesis.id, { falsification_experiment });
  return falsification_experiment;
}

export async function falsificationExperimentDesignerAgentAll(
  obj: OpportunityObject
): Promise<Awaited<ReturnType<typeof listHypothesesByStage>>> {
  const ctx = await loadPhase1Context(obj);
  const selectivity = await listHypothesesByStage(ctx.id, "selectivity");
  for (const h of selectivity) {
    await falsificationExperimentDesignerAgent(ctx, h.id);
  }
  await updateV3OpportunityFields(ctx.id, { v3_phase: "phase1:complete" });
  return listHypothesesByStage(ctx.id, "selectivity");
}
