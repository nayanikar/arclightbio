import type { HypothesisRecord, OpportunityObject } from "@/types/OpportunityObject";
import { callAgentJson } from "@/api/anthropic";
import { listUndruggableTargets } from "@/lib/v3Db";
import { buildPhase2Context, contextPrompt, loadAssessment } from "./helpers";

const SYSTEM = `You are a target druggability validation agent.
The early target screen has already classified undruggable targets. Validate consistency only — do NOT contradict the screen.
If primary target is already in undruggable registry, confirm is_undruggable=true.
Return valid JSON:
{
  "entries": [{
    "target_name": string,
    "intervention_point": string,
    "reasoning": string,
    "alternate_intervention": string | null,
    "is_undruggable": boolean
  }]
}`;

export async function undruggableTargetRegistryAgent(
  obj: OpportunityObject,
  hypothesis: HypothesisRecord
): Promise<void> {
  const ctx = buildPhase2Context(obj, hypothesis);
  const assessment = await loadAssessment(obj.id, hypothesis.id);
  const existing = await listUndruggableTargets(obj.id);

  if (assessment.pipeline_status === "blocked_undruggable") {
    return;
  }

  const screenKey = `phase2:target_screen:${hypothesis.id}`;
  const screenCompleted = (obj.blackboard_state?.completedSteps ?? []).some(
    (step) => step === screenKey || step.startsWith("phase2:target_screen:")
  );
  if (screenCompleted) {
    return;
  }

  try {
    await callAgentJson<{
      entries: Array<{
        target_name: string;
        intervention_point: string;
        reasoning: string;
        alternate_intervention: string | null;
        is_undruggable: boolean;
      }>;
    }>(
      SYSTEM,
      `${contextPrompt(ctx)}
Pipeline status: ${assessment.pipeline_status ?? "active"}
Existing undruggable registry (${existing.length} entries): ${existing.map((e) => e.target_name).join(", ") || "none"}
Druggability score: ${assessment.druggability_score ?? "not scored"}`
    );
  } catch {
    // Validation-only — screen step owns registry writes
  }
}
