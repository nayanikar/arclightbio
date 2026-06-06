import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildProgramSummaryDisplay,
  formatInterventionSummary,
} from "./programSummary";
import type { OpportunityObject } from "@/types/OpportunityObject";

function baseOpp(): OpportunityObject {
  return {
    id: "opp-1",
    version: 1,
    created_at: "2026-01-01",
    last_updated: "2026-01-01",
    anchor_type: "human_prompted",
    status: "complete",
    hypothesis: {
      statement: "Fallback statement",
      patient_population: "",
      unmet_need: "",
      org_positioning: "",
    },
    confidence_score: 0.5,
    actionability_score: 0.5,
    actionability_zone: "too_early",
    evidence_cards: [],
    challenges: [],
    surveillance_tags: { concept_tags: [], entity_tags: [], signal_tags: [] },
    change_log: [],
    context_update_proposals: [],
    org_context_id: "org",
    search_query: "test query",
    schema_version: 3,
    program_hypothesis_sentence: "Program framing sentence",
    hypotheses: [
      {
        id: "h1",
        opportunity_object_id: "opp-1",
        rank: 1,
        is_outgroup: false,
        statement: "HK2 drives Warburg metabolism in resistant tumors",
        patient_population: "NSCLC",
        unmet_need: "Resistance",
        org_positioning: "",
        hypothesis_stage: "selectivity",
        ranked_targets: [
          {
            rank: 1,
            target_name: "SLC2A1",
            gene_symbol: "SLC2A1",
            selectivity_feasibility: 0.7,
            rationale: "Glucose transporter",
          },
        ],
      },
    ],
    selected_phase2_hypothesis_id: "h1",
  };
}

describe("programSummary", () => {
  it("uses stored program_hypothesis_sentence without clipping lead hypothesis", () => {
    const summary = buildProgramSummaryDisplay(baseOpp());
    assert.equal(summary, "Program framing sentence");
    assert.doesNotMatch(summary, /via SLC2A1/);
  });

  it("formatInterventionSummary skips undruggable primary", () => {
    const opp = baseOpp();
    opp.hypotheses![0].ranked_targets = [
      {
        rank: 1,
        target_name: "HK2",
        gene_symbol: "HK2",
        selectivity_feasibility: 0.72,
        rationale: "Warburg node",
      },
      {
        rank: 2,
        target_name: "SLC2A1",
        gene_symbol: "SLC2A1",
        selectivity_feasibility: 0.6,
        rationale: "GLUT1",
      },
    ];
    const intervention = formatInterventionSummary(opp.hypotheses![0], [
      { target_name: "HK2", reasoning: "Undruggable metabolic enzyme" },
    ], true);
    assert.match(intervention ?? "", /SLC2A1/);
    assert.doesNotMatch(intervention ?? "", /HK2/);
  });

  it("formatInterventionSummary returns null when all targets undruggable", () => {
    const opp = baseOpp();
    opp.hypotheses![0].ranked_targets = [
      {
        rank: 1,
        target_name: "HK2",
        gene_symbol: "HK2",
        selectivity_feasibility: 0.72,
        rationale: "Warburg",
      },
    ];
    const intervention = formatInterventionSummary(
      opp.hypotheses![0],
      [{ target_name: "HK2" }],
      true
    );
    assert.equal(intervention, null);
  });
});
