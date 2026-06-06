import type { HypothesisRecord, OpportunityObject } from "@/types/OpportunityObject";
import type { RankedTarget } from "@/types/V3Pipeline";
import {
  isPrimaryUndruggable,
  type UndruggableRef,
} from "@/lib/pipelineBlocked";

export interface ProgramSummaryOptions {
  undruggableTargets?: UndruggableRef[];
  pipelineBlocked?: boolean;
}

function formatTargetIntervention(target: RankedTarget): string | null {
  const name = target.target_name || target.gene_symbol;
  if (!name) return null;

  const modality =
    (target as { recommended_modality?: string }).recommended_modality?.trim() ||
    "targeted intervention";
  return `${name} (${modality})`;
}

function formatIntervention(
  hypothesis?: HypothesisRecord | null,
  undruggableTargets: UndruggableRef[] = [],
  pipelineBlocked = false
): string | null {
  if (!hypothesis) return null;
  const ranked = hypothesis.ranked_targets ?? [];
  if (ranked.length === 0) {
    if (pipelineBlocked || undruggableTargets.length > 0) {
      return null;
    }
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

export function buildProgramSummaryDisplay(
  obj: OpportunityObject,
  leadHypothesis?: HypothesisRecord | null,
  options: ProgramSummaryOptions = {}
): string {
  const lead = leadHypothesis ?? resolveLeadHypothesis(obj);
  const undruggableTargets = options.undruggableTargets ?? [];
  const pipelineBlocked = options.pipelineBlocked ?? false;

  const statement =
    lead?.statement?.trim() ||
    obj.program_hypothesis_sentence?.trim() ||
    obj.hypothesis.statement?.trim() ||
    obj.search_query?.trim() ||
    "Discovery program";

  const intervention = formatIntervention(
    lead,
    undruggableTargets,
    pipelineBlocked
  );

  if (intervention) {
    return `${statement} — proposed intervention: ${intervention}`;
  }

  if (pipelineBlocked || undruggableTargets.length > 0) {
    const primary = lead?.ranked_targets?.[0];
    const primaryName = primary?.target_name || primary?.gene_symbol;
    if (
      pipelineBlocked ||
      (primaryName && isPrimaryUndruggable(primaryName, undruggableTargets))
    ) {
      return `${statement} — direct target modulation not pursued`;
    }
  }

  return statement;
}
