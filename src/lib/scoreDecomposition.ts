import type { Challenge, EvidenceCard, IndicationType } from "@/types/OpportunityObject";
import { getCardEvidenceClass, EVIDENCE_CLASS_WEIGHT } from "@/lib/evidenceClass";
import { scorableEvidenceCards } from "@/lib/scoringCardFilter";
import {
  computeConfidenceScore,
  getActiveTrialCount,
  hasCommercialSaturationSignals,
  TIER_PRIOR,
} from "@/lib/scoring";
import type { EvidenceTier } from "@/types/OpportunityObject";

export interface ScoreDecomposition {
  evidence_weight: number;
  challenge_penalty: number;
  saturation_modifier: number;
  trial_modifier: number;
  genetics_boost: number;
  causal_boost: number;
  weak_ot_penalty: number;
  prior_blend: number;
  final_confidence: number;
  interpretation: string;
}

export const OT_MIN_SCORE = 0.15;
export const TARGET_MISMATCH_PENALTY = 0.15;
export const GENETICS_BOOST_THRESHOLD = 0.3;
export const GENETICS_BOOST = 0.1;

function geneticsBoostFromCards(cards: EvidenceCard[]): number {
  for (const c of cards) {
    const genetics = c.raw_source_metadata?.genetics_score;
    if (typeof genetics === "number" && genetics >= GENETICS_BOOST_THRESHOLD) {
      return GENETICS_BOOST;
    }
  }
  return 0;
}

function weakOtPenalty(cards: EvidenceCard[]): number {
  const weak = cards.filter((c) => c.raw_source_metadata?.weak_association);
  if (weak.length === 0) return 0;
  return Math.min(0.1, weak.length * 0.03);
}

function causalBoost(cards: EvidenceCard[]): number {
  const scorable = scorableEvidenceCards(cards.filter((c) => !c.is_challenge));
  if (scorable.length === 0) return 0;
  const avgClassWeight =
    scorable.reduce((s, c) => s + EVIDENCE_CLASS_WEIGHT[getCardEvidenceClass(c)], 0) /
    scorable.length;
  return Math.max(0, (avgClassWeight - 0.4) * 0.15);
}

export function computeScoreDecomposition(
  cards: EvidenceCard[],
  challenges: Challenge[],
  options?: {
    opportunityTier?: EvidenceTier | null;
    indicationType?: IndicationType | null;
    targetMismatch?: boolean;
  }
): ScoreDecomposition {
  const evidenceOnly = cards.filter((c) => !c.is_challenge);
  const scorable = scorableEvidenceCards(
    evidenceOnly.filter(
      (c) =>
        c.contributing_agent !== "commercial" &&
        c.contributing_agent !== "regulatory"
    )
  );

  const prior =
    TIER_PRIOR[options?.opportunityTier ?? "clinical"] ?? TIER_PRIOR.clinical;

  const evidence_weight =
    scorable.length === 0
      ? 0
      : scorable.reduce((s, c) => s + c.quality_scores.composite, 0) /
        scorable.length;

  const challenge_penalty = Math.min(
    0.2,
    challenges.reduce((sum, c) => sum + Math.abs(c.score_impact), 0)
  );

  const relevantTrialCount = getActiveTrialCount(evidenceOnly);
  const trial_modifier = relevantTrialCount > 10 ? -0.05 : 0;
  const saturation_modifier = hasCommercialSaturationSignals(evidenceOnly)
    ? -0.15
    : 0;

  const genetics_boost = geneticsBoostFromCards(evidenceOnly);
  const causal_boost = causalBoost(evidenceOnly);
  const weak_ot_penalty = weakOtPenalty(evidenceOnly);
  const mismatch_penalty = options?.targetMismatch ? TARGET_MISMATCH_PENALTY : 0;

  const rawScore =
    evidence_weight -
    challenge_penalty +
    trial_modifier +
    saturation_modifier +
    genetics_boost +
    causal_boost -
    weak_ot_penalty -
    mismatch_penalty;

  const PRIOR_WEIGHT = 4;
  const prior_blend =
    scorable.length === 0
      ? prior * 0.5
      : (prior * PRIOR_WEIGHT + rawScore * scorable.length) /
        (PRIOR_WEIGHT + scorable.length);

  const final_confidence = computeConfidenceScore(
    evidenceOnly,
    challenges,
    options?.opportunityTier ?? "clinical"
  );

  const parts: string[] = [
    `${(final_confidence * 100).toFixed(0)}% reflects weighted evidence quality (${(evidence_weight * 100).toFixed(0)}%)`,
  ];
  if (challenge_penalty > 0) {
    parts.push(`regulatory challenges (−${(challenge_penalty * 100).toFixed(0)}%)`);
  }
  if (genetics_boost > 0) parts.push("human genetic support (+10%)");
  if (causal_boost > 0) parts.push("causal/intervention evidence boost");
  if (weak_ot_penalty > 0) parts.push("weak Open Targets associations penalized");
  if (mismatch_penalty > 0) parts.push("target-hypothesis mismatch penalized");
  parts.push("Not probability of clinical success.");

  return {
    evidence_weight,
    challenge_penalty,
    saturation_modifier,
    trial_modifier,
    genetics_boost,
    causal_boost,
    weak_ot_penalty: weak_ot_penalty + mismatch_penalty,
    prior_blend,
    final_confidence,
    interpretation: parts.join("; ") + ".",
  };
}
