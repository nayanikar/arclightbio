import type { HypothesisRecord, OpportunityObject } from "@/types/OpportunityObject";
import type { RankedTarget } from "@/types/V3Pipeline";
import {
  isPrimaryUndruggable,
  type UndruggableRef,
} from "@/lib/pipelineBlocked";

export type ProgramSummaryMode = "headline" | "full";

export interface ProgramSummaryOptions {
  undruggableTargets?: UndruggableRef[];
  pipelineBlocked?: boolean;
  mode?: ProgramSummaryMode;
}

function formatTargetIntervention(target: RankedTarget): string | null {
  const name = target.target_name || target.gene_symbol;
  if (!name) return null;

  const modality =
    (target as { recommended_modality?: string }).recommended_modality?.trim() ||
    "targeted intervention";
  return `${name} (${modality})`;
}

export function resolveLeadHypothesis(
  obj: OpportunityObject,
  hypotheses?: HypothesisRecord[]
): HypothesisRecord | null {
  const list = hypotheses ?? obj.hypotheses ?? [];
  const selectedId =
    obj.selected_phase2_hypothesis_id ?? obj.top_hypothesis_id ?? null;

  if (selectedId) {
    const selected = list.find((h) => h.id === selectedId);
    if (selected) return selected;
  }

  return (
    list
      .filter((h) => !h.is_outgroup)
      .filter(
        (h) =>
          h.hypothesis_stage === "selectivity" ||
          (h.rank != null && h.rank >= 1 && h.rank <= 3)
      )
      .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))[0] ?? null
  );
}

/**
 * Discovery thesis for program hero and dashboard titles.
 * Uses agent-generated program_hypothesis_sentence (≤18 words) — never display-clipped.
 */
export function buildProgramSummaryDisplay(obj: OpportunityObject): string {
  return (
    obj.program_hypothesis_sentence?.trim() ||
    obj.hypothesis.statement?.trim() ||
    obj.search_query?.trim() ||
    "Discovery program"
  );
}

/** @deprecated Used by tests and legacy callers exploring intervention formatting. */
export function formatInterventionSummary(
  hypothesis: HypothesisRecord | null | undefined,
  undruggableTargets: UndruggableRef[],
  pipelineBlocked: boolean
): string | null {
  if (!hypothesis) return null;
  const ranked = hypothesis.ranked_targets ?? [];
  if (ranked.length === 0) {
    if (pipelineBlocked || undruggableTargets.length > 0) return null;
    return null;
  }

  const primary = ranked[0];
  const primaryName = primary.target_name || primary.gene_symbol || "";

  if (
    pipelineBlocked ||
    isPrimaryUndruggable(primaryName, undruggableTargets)
  ) {
    const nextDruggable = ranked.find((t) => {
      const name = t.target_name || t.gene_symbol || "";
      return name && !isPrimaryUndruggable(name, undruggableTargets);
    });
    if (nextDruggable) {
      return formatTargetIntervention(nextDruggable);
    }
    return null;
  }

  return formatTargetIntervention(primary);
}
