import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AgentTrailEntry } from "@/types/AgentTrail";
import {
  deriveCurrentTrailActivity,
  filterTrailForHypothesis,
  humanizeStep,
  sourceTypeLabel,
} from "@/lib/trailLabels";

function entry(
  partial: Partial<AgentTrailEntry> & Pick<AgentTrailEntry, "id" | "kind" | "step">
): AgentTrailEntry {
  return {
    opportunity_id: "opp-1",
    timestamp: "2026-06-05T12:00:00.000Z",
    agent: "crossDomainLiteratureAgent",
    phase: "phase1",
    title: "Literature review",
    ...partial,
  };
}

describe("trailLabels", () => {
  it("humanizeStep maps known phase keys", () => {
    assert.equal(
      humanizeStep("phase1:literature_review"),
      "Cross-domain literature review"
    );
  });

  it("sourceTypeLabel maps pubmed", () => {
    assert.equal(sourceTypeLabel("pubmed"), "PubMed");
  });

  it("filterTrailForHypothesis keeps shared phase1 and matching hypothesis", () => {
    const entries = [
      entry({ id: "1", kind: "completed", step: "phase1:cd1" }),
      entry({
        id: "2",
        kind: "completed",
        step: "phase2:tpp:h1",
        hypothesis_id: "h1",
      }),
      entry({
        id: "3",
        kind: "completed",
        step: "phase2:tpp:h2",
        hypothesis_id: "h2",
      }),
    ];
    const filtered = filterTrailForHypothesis(entries, "h1");
    assert.deepEqual(
      filtered.map((e) => e.id),
      ["1", "2"]
    );
  });

  it("deriveCurrentTrailActivity returns open started step", () => {
    const entries = [
      entry({
        id: "1",
        kind: "started",
        step: "phase1:literature_review",
        timestamp: "2026-06-05T12:00:00.000Z",
      }),
    ];
    assert.equal(deriveCurrentTrailActivity(entries)?.id, "1");
  });

  it("deriveCurrentTrailActivity clears after completed", () => {
    const entries = [
      entry({
        id: "1",
        kind: "started",
        step: "phase1:literature_review",
        timestamp: "2026-06-05T12:00:00.000Z",
      }),
      entry({
        id: "2",
        kind: "completed",
        step: "phase1:literature_review",
        timestamp: "2026-06-05T12:01:00.000Z",
      }),
    ];
    assert.equal(deriveCurrentTrailActivity(entries), null);
  });
});
