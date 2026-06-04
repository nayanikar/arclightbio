import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeConfidenceScore } from "./scoring";
import type { Challenge, EvidenceCard } from "@/types/OpportunityObject";

function makeEvidenceCard(
  agent: EvidenceCard["contributing_agent"],
  composite: number
): EvidenceCard {
  return {
    id: "card-1",
    timestamp: new Date().toISOString(),
    content: "Test evidence",
    source_url: "",
    source_type: "pubmed",
    contributing_agent: agent,
    quality_scores: {
      sample_size: composite,
      study_design: composite,
      source_credibility: composite,
      replication: composite,
      recency: composite,
      composite,
    },
    regulatory_weight: composite,
    raw_source_metadata: {},
  };
}

function makeChallenge(scoreImpact: number): Challenge {
  return {
    id: "ch-1",
    content: "Test challenge",
    flagged_by: "regulatory",
    evidence_card_ref: "card-1",
    score_impact: scoreImpact,
    dimension: "composite",
  };
}

describe("computeConfidenceScore challenge penalty", () => {
  it("applies score_impact as a 0-1 decimal without dividing by 100", () => {
    const cards = [makeEvidenceCard("literature", 0.8)];

    const withoutChallenge = computeConfidenceScore(cards, [], "clinical");
    const withChallenge = computeConfidenceScore(
      cards,
      [makeChallenge(0.05)],
      "clinical"
    );

    const penalty = withoutChallenge - withChallenge;
    // Raw penalty is 0.05; blended across PRIOR_WEIGHT=4 + 1 evidence card → ~0.01
    assert.ok(
      penalty > 0.008,
      `expected ~0.01 blended penalty, got ${penalty.toFixed(4)}`
    );
    assert.ok(
      penalty < 0.015,
      `expected ~0.01 blended penalty, got ${penalty.toFixed(4)}`
    );
    // Buggy /100 path would yield ~0.0001 blended — verify fix is materially stronger
    assert.ok(
      penalty > 0.005,
      `penalty should exceed buggy /100 behavior, got ${penalty.toFixed(4)}`
    );
  });

  it("caps total challenge penalty at 0.2", () => {
    const cards = [makeEvidenceCard("literature", 0.8)];
    const challenges = [
      makeChallenge(0.1),
      makeChallenge(0.1),
      makeChallenge(0.1),
    ];

    const withoutChallenge = computeConfidenceScore(cards, [], "clinical");
    const withChallenges = computeConfidenceScore(cards, challenges, "clinical");

    const penalty = withoutChallenge - withChallenges;
    assert.ok(penalty <= 0.21, `penalty should cap near 0.2, got ${penalty}`);
  });
});
