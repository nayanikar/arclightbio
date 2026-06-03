import type { DashboardMetricRow } from "@/lib/db";
import {
  computeActionabilityScore,
  computeConfidenceScore,
  getActionabilityZoneFromConfidence,
  TIER_PRIOR,
} from "@/lib/scoring";
import { recomputeQualityScoresFromContent } from "@/lib/evidenceQuality";
import {
  getAllEvidenceCards,
  getOpportunityObject,
  listOpportunityObjects,
  deleteEvidenceCards,
  getOrgContext,
  updateOpportunityObject,
  updateEvidenceCard,
} from "@/lib/db";
import type { EvidenceTier } from "@/types/OpportunityObject";
import { classifyQuery, PRIOR_MAP } from "@/lib/queryClassifier";

export async function cleanupExcessChallenges(
  opportunityId: string
): Promise<number> {
  const allCards = await getAllEvidenceCards(opportunityId);
  const challenges = allCards
    .filter((c) => c.is_challenge)
    .sort((a, b) => a.regulatory_weight - b.regulatory_weight);

  if (challenges.length <= 3) return 0;

  const toDelete = challenges.slice(3).map((c) => c.id);
  await deleteEvidenceCards(toDelete);
  return toDelete.length;
}

export async function recomputeOpportunityScores(
  opportunityId: string
): Promise<void> {
  const obj = await getOpportunityObject(opportunityId);
  if (!obj) return;

  const org = await getOrgContext(obj.org_context_id);
  if (!org) return;

  const allCards = await getAllEvidenceCards(opportunityId);
  const evidenceCards = allCards.filter((c) => !c.is_challenge);
  const challenges = allCards
    .filter((c) => c.is_challenge)
    .map((c) => ({
      id: c.id,
      content: c.content,
      flagged_by: "regulatory" as const,
      evidence_card_ref: c.challenge_metadata?.evidence_card_ref ?? "",
      score_impact: c.challenge_metadata?.score_impact ?? 0,
      dimension: c.challenge_metadata?.dimension ?? ("composite" as const),
    }));

  const tier: EvidenceTier = obj.query_tier ?? "clinical";
  const confidence_score = computeConfidenceScore(
    evidenceCards,
    challenges,
    tier
  );
  const actionability = computeActionabilityScore(evidenceCards, org);
  const actionability_zone = getActionabilityZoneFromConfidence(
    confidence_score,
    org
  );

  await updateOpportunityObject(opportunityId, {
    confidence_score,
    actionability_score: actionability.score,
    actionability_zone,
  });
}

export interface ScoreBackfillRow {
  id: string;
  search_query: string | null;
  old_confidence_score: number;
  new_confidence_score: number;
  old_actionability_zone: string;
  new_actionability_zone: string;
  query_tier: string;
  prior: number;
}

export async function backfillEvidenceCardQuality(): Promise<number> {
  const opportunities = await listOpportunityObjects();
  let updated = 0;

  for (const opp of opportunities) {
    const cards = await getAllEvidenceCards(opp.id);
    for (const card of cards) {
      if (card.is_challenge || card.contributing_agent === "clinical_trial") {
        continue;
      }

      const quality = recomputeQualityScoresFromContent(
        card.content,
        card.quality_scores
      );

      const changed =
        quality.study_design !== card.quality_scores.study_design ||
        quality.sample_size !== card.quality_scores.sample_size ||
        quality.composite !== card.quality_scores.composite;

      if (!changed) continue;

      await updateEvidenceCard(card.id, {
        quality_scores: quality,
        regulatory_weight: quality.composite,
      });
      updated += 1;
    }
  }

  return updated;
}

async function ensureQueryTier(
  opportunityId: string,
  searchQuery: string | null | undefined
): Promise<EvidenceTier> {
  const obj = await getOpportunityObject(opportunityId);
  if (!obj) return "clinical";

  if (obj.query_tier != null) {
    console.log(
      `[backfill] Preserving query_tier=${obj.query_tier} for ${opportunityId}`
    );
    return obj.query_tier;
  }

  const query =
    searchQuery?.trim() ||
    obj.search_query?.trim() ||
    obj.hypothesis.statement;

  console.log(`[backfill] query_tier is null — classifying ${opportunityId}`);
  const classification = await classifyQuery(query);

  await updateOpportunityObject(opportunityId, {
    query_tier: classification.tier,
    prior_score: classification.prior_score,
  });

  return classification.tier;
}

export async function backfillAllOpportunities(): Promise<{
  opportunitiesProcessed: number;
  challengesRemoved: number;
  cardsUpdated: number;
  report: ScoreBackfillRow[];
}> {
  const opportunities = await listOpportunityObjects();
  const report: ScoreBackfillRow[] = [];
  let challengesRemoved = 0;

  const cardsUpdated = await backfillEvidenceCardQuality();

  for (const opp of opportunities) {
    if (opp.status === "archived") continue;

    const oldConfidence = opp.confidence_score;
    const oldZone = opp.actionability_zone;

    const queryTier = await ensureQueryTier(opp.id, opp.search_query);

    challengesRemoved += await cleanupExcessChallenges(opp.id);
    await recomputeOpportunityScores(opp.id);

    const refreshed = await getOpportunityObject(opp.id);
    if (!refreshed) continue;

    const tier = refreshed.query_tier ?? queryTier;
    const prior = PRIOR_MAP[tier] ?? TIER_PRIOR[tier];
    report.push({
      id: refreshed.id,
      search_query: refreshed.search_query ?? null,
      old_confidence_score: oldConfidence,
      new_confidence_score: refreshed.confidence_score,
      old_actionability_zone: oldZone,
      new_actionability_zone: refreshed.actionability_zone,
      query_tier: tier,
      prior,
    });
  }

  return {
    opportunitiesProcessed: opportunities.filter((o) => o.status !== "archived")
      .length,
    challengesRemoved,
    cardsUpdated,
    report,
  };
}

export type { DashboardMetricRow };

export function summarizeDashboardMetrics(rows: DashboardMetricRow[]) {
  const avgConfidence =
    rows.length > 0
      ? Math.round(
          (rows.reduce((sum, row) => sum + row.confidence_score, 0) / rows.length) *
            100
        )
      : 0;

  return {
    total: rows.length,
    active: rows.length,
    watching: rows.filter((row) => row.status === "surveillance").length,
    actNow: rows.filter((row) => row.actionability_zone === "act_now").length,
    tooEarly: rows.filter((row) => row.actionability_zone === "too_early").length,
    avgConfidence,
  };
}
