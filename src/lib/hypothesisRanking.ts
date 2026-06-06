import type {
  ActionabilityZone,
  Challenge,
  DeclaredModality,
  EvidenceCard,
  HypothesisRecord,
  OpportunityObject,
  OutgroupValidation,
  RegulatoryPathway,
} from "@/types/OpportunityObject";

export interface RankedHypothesis extends HypothesisRecord {
  rank: number;
}

export function rankHypotheses(
  hypotheses: HypothesisRecord[]
): RankedHypothesis[] {
  const novel = hypotheses
    .filter((h) => !h.is_outgroup)
    .sort((a, b) => {
      const confDiff = (b.confidence_score ?? 0) - (a.confidence_score ?? 0);
      if (Math.abs(confDiff) > 0.001) return confDiff;
      return (b.cross_domain_score ?? 0) - (a.cross_domain_score ?? 0);
    });

  return novel.map((h, i) => ({ ...h, rank: i + 1 }));
}

export function pickTopHypothesis(
  hypotheses: HypothesisRecord[]
): HypothesisRecord | null {
  const ranked = rankHypotheses(hypotheses);
  return ranked[0] ?? null;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function validateOutgroupCalibration(
  hypotheses: HypothesisRecord[],
  challengeCountByHypothesis: Map<string, number>
): OutgroupValidation {
  const outgroup = hypotheses.find((h) => h.is_outgroup);
  const novel = hypotheses.filter((h) => !h.is_outgroup);

  if (!outgroup || novel.length === 0) {
    return {
      status: "scale_unreliable",
      message: "Outgroup calibration skipped — missing outgroup or novel hypotheses.",
    };
  }

  const topNovel = rankHypotheses(novel).slice(0, 3);
  const novelConfidences = topNovel.map((h) => h.confidence_score ?? 0);
  const novelMedianConf = median(novelConfidences);
  const outgroupConf = outgroup.confidence_score ?? 0;

  const novelChallengeCounts = topNovel.map(
    (h) => challengeCountByHypothesis.get(h.id) ?? 0
  );
  const novelMedianChallenges = median(novelChallengeCounts);
  const outgroupChallenges = challengeCountByHypothesis.get(outgroup.id) ?? 0;

  // Crowded-field outgroup should score worse (lower confidence) and attract more challenges.
  const outgroupScoresLower = outgroupConf < novelMedianConf - 0.05;
  const outgroupMoreChallenges =
    outgroupChallenges > novelMedianChallenges + 0.5;

  const calibrated = outgroupScoresLower || outgroupMoreChallenges;

  if (calibrated) {
    return {
      status: "calibrated",
      message:
        "Scoring scale confirmed — outgroup (known crowded field) scores clearly worse than novel hypotheses.",
      outgroup_confidence: outgroupConf,
      novel_median_confidence: novelMedianConf,
      outgroup_challenge_count: outgroupChallenges,
      novel_median_challenges: novelMedianChallenges,
    };
  }

  return {
    status: "scale_unreliable",
    message:
      "Scoring scale may be miscalibrated — outgroup did not score clearly worse than novel hypotheses. Interpret rankings with caution.",
    outgroup_confidence: outgroupConf,
    novel_median_confidence: novelMedianConf,
    outgroup_challenge_count: outgroupChallenges,
    novel_median_challenges: novelMedianChallenges,
  };
}

export function cardsForHypothesis(
  cards: EvidenceCard[],
  hypothesisId: string
): EvidenceCard[] {
  return cards.filter((c) => c.hypothesis_id === hypothesisId);
}

export function challengesFromCards(cards: EvidenceCard[]): Challenge[] {
  return cards
    .filter((c) => c.is_challenge)
    .map((c) => ({
      id: c.id,
      content: c.content,
      flagged_by: "regulatory" as const,
      evidence_card_ref: c.challenge_metadata?.evidence_card_ref ?? "",
      score_impact: c.challenge_metadata?.score_impact ?? 0,
      dimension: c.challenge_metadata?.dimension ?? "composite",
    }));
}

export function applyTopHypothesisScores(
  top: HypothesisRecord
): Pick<
  OpportunityObject,
  "confidence_score" | "actionability_score" | "actionability_zone" | "hypothesis"
> {
  return {
    confidence_score: top.confidence_score ?? 0,
    actionability_score: top.actionability_score ?? 0,
    actionability_zone: (top.actionability_zone ?? "too_early") as ActionabilityZone,
    hypothesis: {
      statement: top.statement,
      patient_population: top.patient_population,
      unmet_need: top.unmet_need,
      org_positioning: top.org_positioning,
      source: top.source,
    },
  };
}

export type { DeclaredModality, RegulatoryPathway };
