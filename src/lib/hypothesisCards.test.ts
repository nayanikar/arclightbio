import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  cardVisibleForHypothesis,
  evidenceCardsForHypothesisScoring,
} from "./hypothesisCards";
import type { EvidenceCard } from "@/types/OpportunityObject";

function litCard(id: string, hypothesisId?: string): EvidenceCard {
  return {
    id,
    content: "paper",
    source_url: "",
    source_type: "pubmed",
    contributing_agent: "literature",
    timestamp: "2026-01-01T00:00:00Z",
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
    hypothesis_id: hypothesisId,
  };
}

function mechCard(id: string, hypothesisId: string, targetList = false): EvidenceCard {
  return {
    id,
    content: "pathway",
    source_url: "",
    source_type: "opentargets",
    contributing_agent: "mechanism",
    timestamp: "2026-01-01T00:00:00Z",
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
    hypothesis_id: hypothesisId,
    is_target_list: targetList,
  };
}

describe("hypothesisCards", () => {
  it("includes shared literature when hypothesis selected", () => {
    assert.equal(cardVisibleForHypothesis(litCard("shared"), "hyp-a"), true);
    assert.equal(cardVisibleForHypothesis(litCard("scoped", "hyp-a"), "hyp-a"), true);
    assert.equal(cardVisibleForHypothesis(litCard("other", "hyp-b"), "hyp-a"), false);
  });

  it("caps outgroup mechanism pathway cards for scoring", () => {
    const cards = [
      mechCard("p1", "og"),
      mechCard("p2", "og"),
      mechCard("list", "og", true),
    ];
    const scored = evidenceCardsForHypothesisScoring(cards, true);
    assert.equal(scored.length, 2);
    assert.ok(scored.some((c) => c.id === "p1"));
    assert.ok(scored.some((c) => c.id === "list"));
    assert.ok(!scored.some((c) => c.id === "p2"));
  });
});
