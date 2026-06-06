import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { HypothesisRecord } from "@/types/OpportunityObject";
import { computeProgramTrustScore } from "./programTrustScore";

function makeSelectivityHyp(rank: number, chainConfidence: number): HypothesisRecord {
  return {
    id: `s${rank}`,
    opportunity_object_id: "opp-1",
    is_outgroup: false,
    hypothesis_stage: "selectivity",
    rank,
    statement: "test",
    patient_population: "test",
    unmet_need: "test",
    org_positioning: "",
    mechanistic_chain: {
      overall_chain_confidence: chainConfidence,
      nodes: [],
      edges: [],
      gaps: [],
      generated_at: new Date().toISOString(),
    },
  } as HypothesisRecord;
}

describe("computeProgramTrustScore", () => {
  it("yields 0.44 when funnel is full and chain confidence averages 0.2", () => {
    const hypotheses: HypothesisRecord[] = [
      ...Array.from({ length: 50 }, (_, i) => ({
        id: `a${i}`,
        is_outgroup: false,
        hypothesis_stage: "association",
      })) as HypothesisRecord[],
      ...Array.from({ length: 20 }, (_, i) => ({
        id: `c${i}`,
        is_outgroup: false,
        hypothesis_stage: "causation",
      })) as HypothesisRecord[],
      makeSelectivityHyp(1, 0.2),
      makeSelectivityHyp(2, 0.2),
      makeSelectivityHyp(3, 0.2),
    ];

    const result = computeProgramTrustScore({
      hypotheses,
      expert_domains: [],
      cd2_associations: [],
    });

    assert.equal(result.overall, 0.44);
    assert.equal(result.funnel_coverage, 1);
    assert.equal(result.evidence_strength, 0.2);
    assert.equal(result.biology_signal, 0);
  });

  it("varies overall when evidence strength changes", () => {
    const baseHyps: HypothesisRecord[] = [
      ...Array.from({ length: 50 }, (_, i) => ({
        id: `a${i}`,
        is_outgroup: false,
        hypothesis_stage: "association",
      })) as HypothesisRecord[],
      ...Array.from({ length: 20 }, (_, i) => ({
        id: `c${i}`,
        is_outgroup: false,
        hypothesis_stage: "causation",
      })) as HypothesisRecord[],
      makeSelectivityHyp(1, 0.8),
    ];

    const low = computeProgramTrustScore({
      hypotheses: [...baseHyps.slice(0, -1), makeSelectivityHyp(1, 0.2)],
      expert_domains: [],
      cd2_associations: [],
    });

    const high = computeProgramTrustScore({
      hypotheses: baseHyps,
      expert_domains: [],
      cd2_associations: [],
    });

    assert.notEqual(low.overall, high.overall);
    assert.ok(high.overall > low.overall);
  });
});
