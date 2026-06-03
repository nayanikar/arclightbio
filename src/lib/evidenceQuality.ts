import type { AgentName, EvidenceCard, QualityScores } from "@/types/OpportunityObject";
import { computeCompositeQuality } from "@/lib/scoring";

export function detectStudyDesign(content: string): number {
  const bracket = content.match(/^\[([^\]]+)\]/)?.[1]?.toLowerCase() ?? "";
  if (
    bracket.includes("meta-analysis") ||
    bracket.includes("systematic review")
  ) {
    return 1.0;
  }
  if (
    bracket.includes("rct") ||
    bracket.includes("randomized") ||
    bracket.includes("randomised")
  ) {
    return 1.0;
  }
  if (bracket.includes("prospective")) return 0.75;
  if (bracket.includes("retrospective")) return 0.45;
  if (bracket.includes("observational") || bracket.includes("cohort")) {
    return 0.3;
  }
  if (
    bracket.includes("case report") ||
    bracket.includes("animal") ||
    bracket.includes("c. elegans")
  ) {
    return 0.15;
  }
  return 0.35;
}

export function detectSampleSize(content: string): number {
  const bracket = content.match(/^\[([^\]]+)\]/)?.[1] ?? "";
  const nMatch = bracket.match(/N[=\s]*([0-9,]+)/i);
  if (nMatch) {
    const n = parseInt(nMatch[1].replace(/,/g, ""), 10);
    if (n > 1000) return 1.0;
    if (n > 500) return 0.9;
    if (n > 200) return 0.75;
    if (n > 100) return 0.6;
    if (n > 30) return 0.45;
    return 0.2;
  }

  if (
    bracket.toLowerCase().includes("meta-analysis") ||
    bracket.toLowerCase().includes("systematic review")
  ) {
    return 0.8;
  }

  return 0.25;
}

export function recomputeQualityScoresFromContent(
  content: string,
  existing: QualityScores
): QualityScores {
  const study_design = detectStudyDesign(content);
  const sample_size = detectSampleSize(content);
  const composite = computeCompositeQuality({
    ...existing,
    study_design,
    sample_size,
  });

  return {
    ...existing,
    study_design,
    sample_size,
    composite,
  };
}

export const CONFIDENCE_TYPE_WEIGHT: Partial<Record<AgentName, number>> = {
  clinical_trial: 1.5,
  literature: 1.0,
  rwe_signal: 0.8,
  mechanism: 0.25,
};

export function getConfidenceScoringCards(cards: EvidenceCard[]): EvidenceCard[] {
  return cards.filter(
    (card) =>
      !card.is_challenge &&
      card.contributing_agent !== "commercial" &&
      card.contributing_agent !== "regulatory"
  );
}

export function weightedConfidenceBaseScore(cards: EvidenceCard[]): number {
  const scoringCards = getConfidenceScoringCards(cards);
  if (scoringCards.length === 0) return 0.15;

  const totalWeight = scoringCards.reduce(
    (sum, card) =>
      sum + (CONFIDENCE_TYPE_WEIGHT[card.contributing_agent] ?? 1.0),
    0
  );

  const weightedScore =
    scoringCards.reduce(
      (sum, card) =>
        sum +
        card.quality_scores.composite *
          (CONFIDENCE_TYPE_WEIGHT[card.contributing_agent] ?? 1.0),
      0
    ) / totalWeight;

  return weightedScore;
}
