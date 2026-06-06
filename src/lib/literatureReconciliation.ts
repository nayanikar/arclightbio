import { callAgentJson } from "@/api/anthropic";
import {
  getAllEvidenceCards,
  getSharedStage1LiteratureCards,
  insertEvidenceCard,
} from "@/lib/db";
import type { HypothesisRecord } from "@/types/OpportunityObject";

const RECONCILIATION_SYSTEM = `You assess whether shared biomedical literature contradicts a ranked drug-discovery hypothesis.
Return valid JSON only: { "contradicts": boolean, "summary": string }
Set contradicts true only when literature materially conflicts with the hypothesis mechanism or direction (not mere nuance).
Summary: 2-3 sentences explaining the tension and what a reviewer should weigh.`;

interface ReconciliationVerdict {
  contradicts: boolean;
  summary: string;
}

export async function emitLiteratureReconciliationCard(
  opportunityId: string,
  top: HypothesisRecord
): Promise<void> {
  if (top.is_outgroup) return;

  const shared = await getSharedStage1LiteratureCards(opportunityId);
  if (shared.length === 0) return;

  const existing = await getAllEvidenceCards(opportunityId);
  if (
    existing.some(
      (c) =>
        c.hypothesis_id === top.id &&
        c.raw_source_metadata?.reconciliation === true
    )
  ) {
    return;
  }

  const literatureBlock = shared
    .slice(0, 8)
    .map((c, i) => `[${i + 1}] ${c.content.slice(0, 220)}`)
    .join("\n");

  let verdict: ReconciliationVerdict;
  try {
    verdict = await callAgentJson<ReconciliationVerdict>(
      RECONCILIATION_SYSTEM,
      `Ranked hypothesis:\n${top.statement}\n\nPatient population: ${top.patient_population}\n\nShared stage-1 literature:\n${literatureBlock}`
    );
  } catch {
    return;
  }

  if (!verdict.contradicts || !verdict.summary?.trim()) return;

  await insertEvidenceCard(
    opportunityId,
    {
      content: `[Literature reconciliation] ${verdict.summary.trim()}`,
      source_url: "",
      source_type: "internal_reasoning",
      contributing_agent: "literature",
      quality_scores: {
        sample_size: 0.5,
        study_design: 0.5,
        source_credibility: 0.7,
        replication: 0.5,
        recency: 0.6,
        composite: 0.55,
      },
      regulatory_weight: 0.5,
      raw_source_metadata: {
        reconciliation: true,
        top_hypothesis_id: top.id,
        contradicting_literature_count: shared.length,
      },
    },
    { hypothesisId: top.id }
  );
}
