import type {
  Hypothesis,
  HypothesisRecord,
  OpportunityObject,
} from "@/types/OpportunityObject";
import { extractKeywords } from "@/lib/hypothesis";
import { AsyncLocalStorage } from "async_hooks";

export const activeHypothesisContext = new AsyncLocalStorage<{
  hypothesisId: string;
  regulatoryPathway?: "NDA" | "BLA";
  declaredModality?: string;
  isOutgroup?: boolean;
}>();

export function getActiveHypothesisId(): string | undefined {
  return activeHypothesisContext.getStore()?.hypothesisId;
}

export async function runWithHypothesisContext<T>(
  hypothesis: HypothesisRecord,
  fn: () => Promise<T>
): Promise<T> {
  return activeHypothesisContext.run(
    {
      hypothesisId: hypothesis.id,
      regulatoryPathway: hypothesis.regulatory_pathway ?? undefined,
      declaredModality: hypothesis.declared_modality ?? undefined,
      isOutgroup: hypothesis.is_outgroup,
    },
    fn
  );
}

export function hypothesisRecordToHypothesis(h: HypothesisRecord): Hypothesis {
  return {
    statement: h.statement,
    patient_population: h.patient_population,
    unmet_need: h.unmet_need,
    org_positioning: h.org_positioning,
    source: h.source,
  };
}

/** Patch opportunity with a specific hypothesis for v1 agent compatibility. */
export function withHypothesis(
  obj: OpportunityObject,
  record: HypothesisRecord
): OpportunityObject {
  return {
    ...obj,
    hypothesis: hypothesisRecordToHypothesis(record),
  };
}

/** Per-hypothesis v2 agents must query APIs from the active hypothesis, not session search_query. */
export function resolveAgentQuery(obj: OpportunityObject): string {
  if (obj.schema_version === 2 || getActiveHypothesisId()) {
    return obj.hypothesis.statement;
  }
  return obj.search_query ?? obj.hypothesis.statement;
}

export function resolveAgentKeywords(obj: OpportunityObject) {
  const statement = resolveAgentQuery(obj);
  return extractKeywords("", {
    ...obj.hypothesis,
    statement,
  });
}

export function placeholderHypothesis(query: string): Hypothesis {
  return {
    statement: `Discovery in progress for: ${query}`,
    patient_population: "Pending candidate generation",
    unmet_need: "Pending candidate generation",
    org_positioning: "Pending candidate generation",
    source: "fallback",
  };
}

/** Stage-1 literature relevance anchor — use search query, not placeholder text (V2-029). */
export function stage1LiteratureHypothesis(query: string): Hypothesis {
  const q = query.trim();
  return {
    statement: q,
    patient_population: `Patients relevant to: ${q.slice(0, 120)}`,
    unmet_need: `Evidence gap for: ${q.slice(0, 120)}`,
    org_positioning: "Pending candidate generation",
    source: "fallback",
  };
}

/** Enrich list/dashboard rows with top-hypothesis summary for v2 (V2-037). */
export function applyTopHypothesisListSummary(
  obj: OpportunityObject,
  hypotheses: HypothesisRecord[]
): OpportunityObject {
  if ((obj.schema_version ?? 1) !== 2 || hypotheses.length === 0) {
    return obj;
  }

  const top =
    hypotheses.find((h) => h.id === obj.top_hypothesis_id) ??
    hypotheses.find((h) => h.rank === 1) ??
    hypotheses.find((h) => !h.is_outgroup) ??
    hypotheses[0];

  if (!top) {
    return { ...obj, hypotheses };
  }

  return withHypothesis(
    {
      ...obj,
      hypotheses,
      confidence_score: top.confidence_score ?? obj.confidence_score,
      actionability_score: top.actionability_score ?? obj.actionability_score,
      actionability_zone: top.actionability_zone ?? obj.actionability_zone,
    },
    top
  );
}
