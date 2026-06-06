import type { HypothesisRecord } from "@/types/OpportunityObject";
import type { DrugDiscoveryAssessment } from "@/types/V3Pipeline";
import { isTargetUndraggable } from "@/lib/targetRegistryMatch";

export interface UndruggableRef {
  target_name: string;
  hypothesis_id?: string | null;
  reasoning?: string;
}

export function resolvePrimaryTargetName(
  hypothesis?: HypothesisRecord | null
): string | null {
  const primary = hypothesis?.ranked_targets?.[0];
  return primary?.target_name ?? primary?.gene_symbol ?? null;
}

export function isPrimaryUndruggable(
  primaryTarget: string | null,
  undruggableTargets: UndruggableRef[]
): boolean {
  if (!primaryTarget?.trim() || undruggableTargets.length === 0) return false;
  return isTargetUndraggable(primaryTarget, undruggableTargets);
}

export function isPipelineBlocked(
  assessment: DrugDiscoveryAssessment | undefined | null,
  undruggableTargets: UndruggableRef[],
  primaryTarget: string | null,
  leadHypothesis?: HypothesisRecord | null
): boolean {
  if (assessment?.pipeline_status === "blocked_undruggable") {
    return true;
  }

  if (isPrimaryUndruggable(primaryTarget, undruggableTargets)) {
    return true;
  }

  const ranked = leadHypothesis?.ranked_targets ?? [];
  if (ranked.length === 0 && undruggableTargets.length > 0) {
    const hid = leadHypothesis?.id;
    const hasHypUndruggable = hid
      ? undruggableTargets.some((u) => u.hypothesis_id === hid)
      : undruggableTargets.length > 0;
    if (hasHypUndruggable) return true;
  }

  return false;
}

export function blockedReason(
  assessment: DrugDiscoveryAssessment | undefined | null,
  undruggableTargets: UndruggableRef[],
  primaryTarget: string | null
): string {
  if (assessment?.blocked_reason?.trim()) {
    return assessment.blocked_reason.trim();
  }

  if (primaryTarget && isPrimaryUndruggable(primaryTarget, undruggableTargets)) {
    const entry = undruggableTargets.find(
      (u) =>
        u.target_name.toLowerCase() === primaryTarget.toLowerCase() ||
        primaryTarget.toLowerCase().includes(u.target_name.toLowerCase())
    );
    if (entry?.reasoning) {
      return `Primary target ${primaryTarget} failed druggability screen: ${entry.reasoning}`;
    }
    return `Primary target ${primaryTarget} is in the undruggable registry — direct target modulation not pursued.`;
  }

  return "Primary target failed three-modality druggability screen — direct target modulation not pursued.";
}
