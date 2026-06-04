import type {
  AgentName,
  Challenge,
  EvidenceCard,
  ActionabilityZone,
  EvidenceTier,
  IndicationType,
} from "@/types/OpportunityObject";
import type { OrganizationContext } from "@/types/OrganizationContext";
import { getIndicationRiskWeights } from "@/lib/indicationRisk";

const CONFIDENCE_TYPE_WEIGHT: Partial<Record<AgentName, number>> = {
  clinical_trial: 1.5,
  literature: 1.0,
  rwe_signal: 0.8,
  mechanism: 0.25,
};

const DEFAULT_PRIOR_SCORE = 0.45;

export const TIER_PRIOR: Record<EvidenceTier, number> = {
  preclinical: 0.15,
  clinical: 0.45,
  established: 0.70,
};

function getRelevantTrialCount(cards: EvidenceCard[]): number {
  const clinicalCard = cards.find(
    (c) => c.contributing_agent === "clinical_trial" && !c.is_challenge
  );
  if (!clinicalCard) return 0;

  const metadata = clinicalCard.raw_source_metadata;
  if (typeof metadata.relevantTrialCount === "number") {
    return metadata.relevantTrialCount;
  }
  if (typeof metadata.relevant_trial_count === "number") {
    return metadata.relevant_trial_count;
  }
  return 0;
}

export function computeConfidenceScore(
  cards: EvidenceCard[],
  challenges: Challenge[],
  opportunityTier?: EvidenceTier | null
): number {
  const prior =
    TIER_PRIOR[opportunityTier ?? "clinical"] ?? TIER_PRIOR.clinical;

  const evidenceCards = cards.filter(
    (c) =>
      !c.is_challenge &&
      c.contributing_agent !== "commercial" &&
      c.contributing_agent !== "regulatory"
  );

  if (evidenceCards.length === 0) {
    return Math.round(prior * 0.5 * 10000) / 10000;
  }

  const scoringCards = evidenceCards.filter(
    (c) => CONFIDENCE_TYPE_WEIGHT[c.contributing_agent] !== undefined
  );

  if (scoringCards.length === 0) {
    return Math.round(prior * 0.5 * 10000) / 10000;
  }

  const totalWeight = scoringCards.reduce(
    (sum, c) => sum + getCardConfidenceWeight(c),
    0
  );

  const weightedEvidenceScore =
    scoringCards.reduce(
      (sum, c) =>
        sum +
        c.quality_scores.composite * getCardConfidenceWeight(c),
      0
    ) / totalWeight;

  const challengePenalty = Math.min(
    0.2,
    challenges.reduce((sum, c) => sum + Math.abs(c.score_impact), 0)
  );

  const relevantTrialCount = getRelevantTrialCount(cards);
  const saturationBonus = relevantTrialCount > 10 ? 0.08 : 0;

  const rawScore = weightedEvidenceScore - challengePenalty + saturationBonus;

  const PRIOR_WEIGHT = 4;
  const blended =
    (prior * PRIOR_WEIGHT + rawScore * evidenceCards.length) /
    (PRIOR_WEIGHT + evidenceCards.length);

  return Math.round(Math.min(1, Math.max(0.1, blended)) * 10000) / 10000;
}

function getCardConfidenceWeight(card: EvidenceCard): number {
  const base = CONFIDENCE_TYPE_WEIGHT[card.contributing_agent] ?? 1.0;
  if (card.is_cross_domain && card.contributing_agent === "literature") {
    return base * 1.5;
  }
  return base;
}

export function getActionabilityZoneFromConfidence(
  score: number,
  context?: OrganizationContext | null,
  indicationType?: IndicationType | null
): ActionabilityZone {
  const orgLower =
    context?.risk_tolerance?.actionability_lower_threshold ?? 0.3;
  const orgUpper =
    context?.risk_tolerance?.actionability_upper_threshold ?? 0.75;

  const indicationMin =
    getIndicationRiskWeights(indicationType).minimum_confidence_for_act_now;
  const lower =
    indicationType != null ? indicationMin : orgLower;

  if (score < lower) return "too_early";
  if (score > orgUpper) return "crowded";
  return "act_now";
}

export function computeActionabilityZone(
  score: number,
  context: OrganizationContext
): ActionabilityZone {
  return getActionabilityZoneFromConfidence(score, context);
}

const COMMERCIAL_SATURATION_KEYWORDS = [
  "saturated",
  "dominated",
  "established players",
  "barriers to entry",
  "highly competitive",
  "crowded market",
];

export function hasCommercialSaturationSignals(cards: EvidenceCard[]): boolean {
  const commercialCard = cards.find((c) => c.contributing_agent === "commercial");
  if (!commercialCard) return false;

  const lower = commercialCard.content.toLowerCase();
  return COMMERCIAL_SATURATION_KEYWORDS.some((keyword) =>
    lower.includes(keyword)
  );
}

export function getActiveTrialCount(cards: EvidenceCard[]): number {
  return getRelevantTrialCount(cards);
}

export interface ActionabilityScoreResult {
  score: number;
  baseScore: number;
  saturationModifier: number;
  trialCountModifier: number;
  modifierSummary: string | null;
}

export function computeActionabilityScore(
  cards: EvidenceCard[],
  context: OrganizationContext
): ActionabilityScoreResult {
  const evidenceCards = cards.filter((c) => !c.is_challenge);
  if (evidenceCards.length === 0) {
    return {
      score: 0,
      baseScore: 0,
      saturationModifier: 0,
      trialCountModifier: 0,
      modifierSummary: null,
    };
  }

  const weights = context.commercial_weights;
  const avgQuality =
    evidenceCards.reduce((sum, c) => sum + c.quality_scores.composite, 0) /
    evidenceCards.length;

  const agentCoverage = new Set(evidenceCards.map((c) => c.contributing_agent)).size / 6;
  const recencyAvg =
    evidenceCards.reduce((sum, c) => sum + c.quality_scores.recency, 0) /
    evidenceCards.length;

  const baseScore = Math.max(
    0,
    Math.min(
      1,
      avgQuality * 0.4 +
        agentCoverage * 0.25 * weights.first_mover_importance +
        recencyAvg * 0.2 * weights.market_size_importance +
        (evidenceCards.length / 20) * 0.15 * weights.competitive_moat_importance
    )
  );

  const saturationModifier = hasCommercialSaturationSignals(evidenceCards)
    ? 0.25
    : 0;
  const activeTrialCount = getActiveTrialCount(evidenceCards);
  const trialCountModifier = activeTrialCount > 15 ? 0.1 : 0;

  const score = Math.min(1, baseScore + saturationModifier + trialCountModifier);

  const modifierParts: string[] = [];
  if (saturationModifier > 0) {
    modifierParts.push("+0.25 commercial saturation");
  }
  if (trialCountModifier > 0) {
    modifierParts.push("+0.10 high trial count");
  }

  const modifierSummary =
    modifierParts.length > 0
      ? `Actionability score adjusted: ${modifierParts.join(", ")}`
      : null;

  return {
    score,
    baseScore,
    saturationModifier,
    trialCountModifier,
    modifierSummary,
  };
}

export function computeCompositeQuality(scores: {
  sample_size: number;
  study_design: number;
  source_credibility: number;
  replication: number;
  recency: number;
}): number {
  return (
    scores.sample_size * 0.2 +
    scores.study_design * 0.25 +
    scores.source_credibility * 0.2 +
    scores.replication * 0.2 +
    scores.recency * 0.15
  );
}

export async function computeAndPersistScores(
  opportunityId: string,
  getObj: () => Promise<{
    evidence_cards: EvidenceCard[];
    challenges: Challenge[];
    org_context_id: string;
    prior_score?: number;
    query_tier?: EvidenceTier;
  } | null>,
  getOrg: (id: string) => Promise<OrganizationContext | null>,
  update: (
    id: string,
    scores: {
      confidence_score: number;
      actionability_score: number;
      actionability_zone: ActionabilityZone;
    }
  ) => Promise<void>
): Promise<{
  confidence_score: number;
  actionability_score: number;
  actionability_zone: ActionabilityZone;
}> {
  const obj = await getObj();
  if (!obj) throw new Error("Opportunity not found");

  const org = await getOrg(obj.org_context_id);
  if (!org) throw new Error("Org context not found");

  const allCards = await import("@/lib/db").then((m) =>
    m.getAllEvidenceCards(opportunityId)
  );
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

  const evidenceOnly = allCards.filter((c) => !c.is_challenge);
  const confidence_score = computeConfidenceScore(
    evidenceOnly,
    challenges,
    obj.query_tier ?? "clinical"
  );
  const actionability = computeActionabilityScore(evidenceOnly, org);
  const actionability_zone = getActionabilityZoneFromConfidence(
    confidence_score,
    org
  );

  await update(opportunityId, {
    confidence_score,
    actionability_score: actionability.score,
    actionability_zone,
  });

  return {
    confidence_score,
    actionability_score: actionability.score,
    actionability_zone,
  };
}

export { DEFAULT_PRIOR_SCORE };
