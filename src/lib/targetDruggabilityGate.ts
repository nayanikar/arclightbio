import type { HypothesisRecord } from "@/types/OpportunityObject";
import type { RankedTarget } from "@/types/V3Pipeline";
import { insertUndruggableTarget, updateV3Hypothesis } from "@/lib/v3Db";

export type FailedModality = "small_molecule" | "biologic" | "adc";

export interface TargetScreenEntry {
  target_name: string;
  is_undruggable: boolean;
  failed_modalities: FailedModality[];
  reasoning: string;
  alternate_intervention: string | null;
}

export interface TargetScreenResult {
  druggable: RankedTarget[];
  undruggable: TargetScreenEntry[];
  primaryTarget: string | null;
}

function targetKey(name: string): string {
  return name.toLowerCase().trim();
}

function resolveScreenEntry(
  target: RankedTarget,
  screenResults: TargetScreenEntry[]
): TargetScreenEntry | undefined {
  const keys = [target.target_name, target.gene_symbol ?? ""].map(targetKey).filter(Boolean);
  return screenResults.find((r) => {
    const rk = targetKey(r.target_name);
    return keys.some((k) => k === rk || k.includes(rk) || rk.includes(k));
  });
}

export function partitionScreenResults(
  rankedTargets: RankedTarget[],
  screenResults: TargetScreenEntry[]
): TargetScreenResult {
  const druggable: RankedTarget[] = [];
  const undruggable: TargetScreenEntry[] = [];

  for (const target of rankedTargets) {
    const screen = resolveScreenEntry(target, screenResults);
    if (screen?.is_undruggable) {
      undruggable.push(screen);
    } else {
      druggable.push(target);
    }
  }

  const reranked = druggable.map((t, i) => ({ ...t, rank: i + 1 }));

  return {
    druggable: reranked,
    undruggable,
    primaryTarget: reranked[0]?.target_name ?? reranked[0]?.gene_symbol ?? null,
  };
}

export async function applyTargetScreen(
  opportunityId: string,
  hypothesis: HypothesisRecord,
  screenResults: TargetScreenEntry[]
): Promise<{ updatedHypothesis: HypothesisRecord; blocked: boolean }> {
  const ranked = hypothesis.ranked_targets ?? [];
  const { druggable, undruggable } = partitionScreenResults(ranked, screenResults);

  for (const entry of undruggable) {
    await insertUndruggableTarget({
      opportunity_object_id: opportunityId,
      hypothesis_id: hypothesis.id,
      target_name: entry.target_name,
      intervention_point: entry.failed_modalities.join(", ") || "All modality classes",
      reasoning: entry.reasoning,
      alternate_intervention: entry.alternate_intervention,
      rescan_eligible: true,
    });
  }

  const updatedHypothesis: HypothesisRecord = {
    ...hypothesis,
    ranked_targets: druggable,
  };

  await updateV3Hypothesis(opportunityId, hypothesis.id, {
    ranked_targets: druggable,
  });

  return {
    updatedHypothesis,
    blocked: druggable.length === 0,
  };
}
