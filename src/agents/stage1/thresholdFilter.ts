import { searchPubMed } from "@/api/pubmed";
import { getAdverseEvents } from "@/api/openFda";
import { createOpportunityObject } from "@/lib/db";
import { generateHypothesis } from "@/lib/hypothesis";
import { scheduleBlackboardRun } from "@/lib/blackboard";
import { DEFAULT_ORG_CONTEXTS } from "@/lib/db";

export async function patternScanner(
  categoryA: string,
  categoryB: string
): Promise<{ signal: boolean; count: number; papers: string[] }> {
  const query = `(${categoryA}) AND (${categoryB})`;
  const papers = await searchPubMed(query, 20);
  const recent = papers.filter((p) => p.year >= new Date().getFullYear() - 2);
  return {
    signal: recent.length >= 3,
    count: recent.length,
    papers: recent.map((p) => p.pmid),
  };
}

export async function anomalyDetector(
  drugClass: string
): Promise<{ signal: boolean; offLabelPct: number }> {
  const events = await getAdverseEvents(drugClass, 200);
  const total = events.reduce((s, e) => s + e.count, 0);
  const withIndication = events.filter((e) => e.indication).reduce((s, e) => s + e.count, 0);
  const pct = total > 0 ? withIndication / total : 0;
  return { signal: pct >= 0.05, offLabelPct: pct };
}

export async function gapFinder(
  meshTerm: string
): Promise<{ signal: boolean; ratio: number; paperCount: number; trialCount: number }> {
  const { getPubMedCount } = await import("@/api/pubmed");
  const { getTrialCount } = await import("@/api/clinicalTrials");
  const paperCount = await getPubMedCount(meshTerm);
  const trialCount = await getTrialCount(meshTerm);
  const ratio = trialCount > 0 ? paperCount / trialCount : paperCount;
  return {
    signal: ratio > 10 && paperCount > 20,
    ratio,
    paperCount,
    trialCount,
  };
}

export async function thresholdFilter(
  signals: boolean[],
  hypothesis: { statement: string; categoryA: string; categoryB: string }
): Promise<string | null> {
  const converged = signals.filter(Boolean).length;
  if (converged < 2) return null;

  const query = `${hypothesis.categoryA} ${hypothesis.categoryB}`;
  const papers = await searchPubMed(query, 5);
  const hyp = await generateHypothesis(
    query,
    papers,
    DEFAULT_ORG_CONTEXTS[0]
  );

  const obj = await createOpportunityObject({
    anchor_type: "auto_generated",
    hypothesis: hyp,
    org_context_id: DEFAULT_ORG_CONTEXTS[0].id,
    search_query: query,
    mode: "speed",
  });

  scheduleBlackboardRun(obj.id);
  return obj.id;
}
