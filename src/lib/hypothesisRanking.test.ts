import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  rankHypotheses,
  validateOutgroupCalibration,
  pickTopHypothesis,
} from "./hypothesisRanking";
import type { HypothesisRecord } from "@/types/OpportunityObject";

function makeHypothesis(
  overrides: Partial<HypothesisRecord> & { id: string }
): HypothesisRecord {
  return {
    opportunity_object_id: "opp-1",
    rank: 1,
    is_outgroup: false,
    statement: "Test",
    patient_population: "Patients",
    unmet_need: "Need",
    org_positioning: "Org",
    confidence_score: 0.5,
    cross_domain_score: 0.5,
    ...overrides,
  };
}

describe("hypothesisRanking", () => {
  it("ranks novel hypotheses by confidence excluding outgroup", () => {
    const ranked = rankHypotheses([
      makeHypothesis({ id: "a", confidence_score: 0.4, rank: 2 }),
      makeHypothesis({ id: "b", confidence_score: 0.7, rank: 1 }),
      makeHypothesis({
        id: "og",
        is_outgroup: true,
        confidence_score: 0.9,
      }),
    ]);
    assert.equal(ranked.length, 2);
    assert.equal(ranked[0].id, "b");
    assert.equal(ranked[1].id, "a");
  });

  it("validates calibrated outgroup when outgroup scores lower than novel median", () => {
    const hypotheses = [
      makeHypothesis({ id: "n1", confidence_score: 0.45 }),
      makeHypothesis({ id: "n2", confidence_score: 0.5 }),
      makeHypothesis({
        id: "og",
        is_outgroup: true,
        confidence_score: 0.25,
      }),
    ];
    const map = new Map([
      ["n1", 2],
      ["n2", 1],
      ["og", 4],
    ]);
    const result = validateOutgroupCalibration(hypotheses, map);
    assert.equal(result.status, "calibrated");
  });

  it("flags scale_unreliable when outgroup scores higher than novel median", () => {
    const hypotheses = [
      makeHypothesis({ id: "n1", confidence_score: 0.45 }),
      makeHypothesis({ id: "n2", confidence_score: 0.5 }),
      makeHypothesis({
        id: "og",
        is_outgroup: true,
        confidence_score: 0.82,
      }),
    ];
    const map = new Map([
      ["n1", 2],
      ["n2", 1],
      ["og", 0],
    ]);
    const result = validateOutgroupCalibration(hypotheses, map);
    assert.equal(result.status, "scale_unreliable");
  });

  it("pickTopHypothesis returns highest confidence novel hypothesis", () => {
    const top = pickTopHypothesis([
      makeHypothesis({ id: "a", confidence_score: 0.55 }),
      makeHypothesis({ id: "b", confidence_score: 0.68 }),
      makeHypothesis({ id: "og", is_outgroup: true, confidence_score: 0.9 }),
    ]);
    assert.equal(top?.id, "b");
  });
});
