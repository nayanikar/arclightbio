import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isScorableEvidenceCard } from "./scoringCardFilter";
import type { EvidenceCard } from "@/types/OpportunityObject";

function card(partial: Partial<EvidenceCard>): EvidenceCard {
  return {
    id: "c1",
    content: "Evidence claim",
    source_url: "",
    source_type: "pubmed",
    contributing_agent: "literature",
    timestamp: new Date().toISOString(),
    quality_scores: {
      sample_size: 0.5,
      study_design: 0.5,
      source_credibility: 0.5,
      replication: 0.5,
      recency: 0.5,
      composite: 0.5,
    },
    regulatory_weight: 0.5,
    raw_source_metadata: {},
    ...partial,
  };
}

describe("scoringCardFilter", () => {
  it("excludes partial and failure cards", () => {
    assert.equal(isScorableEvidenceCard(card({ raw_source_metadata: { partial: true } })), false);
    assert.equal(
      isScorableEvidenceCard(card({ content: "No PubMed results for query" })),
      false
    );
    assert.equal(isScorableEvidenceCard(card({ is_challenge: true })), false);
    assert.equal(isScorableEvidenceCard(card({})), true);
  });
});
