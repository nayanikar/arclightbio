import type { HypothesisRecord, OpportunityObject } from "@/types/OpportunityObject";
import { listUndruggableTargets } from "@/lib/v3Db";
import { buildPhase2Context } from "./helpers";

export interface TargetSelectionGuardResult {
  blocked: boolean;
  warnings: string[];
  alternate_suggestions: string[];
}

export async function targetSelectionGuardAgent(
  obj: OpportunityObject,
  hypothesis: HypothesisRecord
): Promise<TargetSelectionGuardResult> {
  const ctx = buildPhase2Context(obj, hypothesis);
  const registry = await listUndruggableTargets(obj.id);

  const warnings: string[] = [];
  const alternate_suggestions: string[] = [];
  let blocked = false;

  for (const entry of registry) {
    if (
      entry.target_name.toLowerCase() === ctx.primaryTarget.toLowerCase() ||
      ctx.primaryTarget.toLowerCase().includes(entry.target_name.toLowerCase())
    ) {
      blocked = true;
      warnings.push(
        `Target ${entry.target_name} is in undruggable registry: ${entry.reasoning}`
      );
      if (entry.alternate_intervention) {
        alternate_suggestions.push(entry.alternate_intervention);
      }
    }
  }

  const lowDruggabilityTargets = (hypothesis.ranked_targets ?? []).filter(
    (t) => t.selectivity_feasibility < 0.2
  );
  for (const t of lowDruggabilityTargets) {
    warnings.push(
      `Low selectivity feasibility for ${t.target_name} — consider alternate intervention point.`
    );
  }

  return { blocked, warnings, alternate_suggestions };
}
