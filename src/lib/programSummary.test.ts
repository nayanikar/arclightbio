import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildProgramSummaryDisplay } from "./programSummary";
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
  it("builds discovery thesis from lead hypothesis and intervention", () => {
    const summary = buildProgramSummaryDisplay(baseOpp());
    assert.match(summary, /HK2 drives Warburg/);
    assert.match(summary, /proposed intervention: SLC2A1/);
  });

  it("does not propose undruggable primary as intervention", () => {
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
    const summary = buildProgramSummaryDisplay(opp, opp.hypotheses![0], {
      undruggableTargets: [
        { target_name: "HK2", reasoning: "Undruggable metabolic enzyme" },
      ],
      pipelineBlocked: true,
    });
    assert.doesNotMatch(summary, /proposed intervention: HK2/);
    assert.match(summary, /proposed intervention: SLC2A1/);
  });

  it("shows not pursued when all targets undruggable", () => {
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
    const summary = buildProgramSummaryDisplay(opp, opp.hypotheses![0], {
      undruggableTargets: [{ target_name: "HK2" }],
      pipelineBlocked: true,
    });
    assert.match(summary, /direct target modulation not pursued/);
    assert.doesNotMatch(summary, /proposed intervention/);
  });
});
