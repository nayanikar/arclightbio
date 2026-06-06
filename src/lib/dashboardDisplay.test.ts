import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OpportunityObject } from "@/types/OpportunityObject";
import {
  buildDashboardProgramViews,
  computeDashboardMetrics,
  getPhaseOrder,
  resolveConfidence,
  resolveTitle,
  sortDashboardPrograms,
  toDashboardProgramView,
} from "@/lib/dashboardDisplay";

function baseOpp(
  overrides: Partial<OpportunityObject> = {}
): OpportunityObject {
  return {
    id: "aaaaaaaa-bbbb-cccc-dddd-111111111111",
    version: 1,
    created_at: "2026-06-05T10:00:00.000Z",
    last_updated: "2026-06-05T12:00:00.000Z",
    anchor_type: "human_prompted",
    status: "paused",
    hypothesis: {
      statement: "Hypothesis statement for testing",
      patient_population: "",
      unmet_need: "Unmet need summary",
      org_positioning: "",
    },
    confidence_score: 0.23,
    actionability_score: 0.2,
    actionability_zone: "too_early",
    evidence_cards: [],
    challenges: [],
    surveillance_tags: { concept_tags: [], entity_tags: [], signal_tags: [] },
    change_log: [],
    context_update_proposals: [],
    org_context_id: "",
    search_query: "cancer patients without dominant oncogenic mutation",
    ...overrides,
  };
}

describe("dashboardDisplay", () => {
  it("resolveTitle prefers V3 program_hypothesis_sentence", () => {
    const opp = baseOpp({
      schema_version: 3,
      program_hypothesis_sentence: "Adult oncology patients lacking driver mutations",
      hypothesis: {
        ...baseOpp().hypothesis,
        statement: "Fallback hypothesis",
      },
    });
    assert.equal(
      resolveTitle(opp),
      "Adult oncology patients lacking driver mutations"
    );
  });

  it("resolveConfidence uses program_trust_score for V3", () => {
    const opp = baseOpp({
      schema_version: 3,
      program_trust_score: 0.44,
      confidence_score: 0.23,
    });
    assert.equal(resolveConfidence(opp), 0.44);
  });

  it("getPhaseOrder ranks later phases higher", () => {
    assert.ok(
      getPhaseOrder("phase1:complete") > getPhaseOrder("phase1:literature_review")
    );
    assert.ok(
      getPhaseOrder("phase2:complete") > getPhaseOrder("phase1:complete")
    );
  });

  it("assigns stable serial numbers by created_at", () => {
    const views = buildDashboardProgramViews([
      baseOpp({
        id: "bbbbbbbb-bbbb-cccc-dddd-222222222222",
        created_at: "2026-06-05T11:00:00.000Z",
      }),
      baseOpp({
        id: "aaaaaaaa-bbbb-cccc-dddd-111111111111",
        created_at: "2026-06-05T10:00:00.000Z",
      }),
    ]);
    const byId = Object.fromEntries(views.map((v) => [v.id, v.serial]));
    assert.equal(byId["aaaaaaaa-bbbb-cccc-dddd-111111111111"], 1);
    assert.equal(byId["bbbbbbbb-bbbb-cccc-dddd-222222222222"], 2);
  });

  it("computeDashboardMetrics counts paused and uses V3 trust for average", () => {
    const metrics = computeDashboardMetrics([
      baseOpp({
        status: "paused",
        schema_version: 3,
        program_trust_score: 0.5,
        confidence_score: 0.2,
      }),
      baseOpp({
        id: "bbbbbbbb-bbbb-cccc-dddd-222222222222",
        status: "agents_running",
        actionability_zone: "act_now",
        schema_version: 3,
        program_trust_score: 0.3,
        confidence_score: 0.1,
      }),
    ]);
    assert.equal(metrics.programs, 2);
    assert.equal(metrics.paused, 1);
    assert.equal(metrics.running, 1);
    assert.equal(metrics.actNow, 1);
    assert.equal(metrics.avgConfidence, 40);
  });

  it("sortDashboardPrograms orders by confidence descending", () => {
    const views = buildDashboardProgramViews([
      baseOpp({ confidence_score: 0.2, program_trust_score: undefined }),
      baseOpp({
        id: "bbbbbbbb-bbbb-cccc-dddd-222222222222",
        schema_version: 3,
        program_trust_score: 0.6,
        confidence_score: 0.1,
      }),
    ]);
    const sorted = sortDashboardPrograms(views, "confidence", "desc");
    assert.equal(sorted[0].confidence, 0.6);
  });

  it("toDashboardProgramView includes serial from map", () => {
    const serialById = new Map([
      ["aaaaaaaa-bbbb-cccc-dddd-111111111111", 3],
    ]);
    const view = toDashboardProgramView(baseOpp(), serialById);
    assert.equal(view.serial, 3);
  });

  it("resolveTitle uses agent-generated program_hypothesis_sentence without clipping", () => {
    const opp = baseOpp({
      schema_version: 3,
      program_hypothesis_sentence:
        "Oncogene-negative refractory tumors may respond to NSD1 methyltransferase inhibition.",
      hypotheses: [
        {
          id: "h1",
          opportunity_object_id: "aaaaaaaa-bbbb-cccc-dddd-111111111111",
          rank: 1,
          is_outgroup: false,
          statement:
            "ARID1A loss-of-function mutations in treatment-refractory cancers create chromatin-metabolic vulnerabilities that are selectively targetable by NSD1 methyltransferase inhibitors through synthetic lethality",
          patient_population: "",
          unmet_need: "",
          org_positioning: "",
          hypothesis_stage: "selectivity",
          ranked_targets: [
            {
              rank: 1,
              target_name: "NSD1",
              gene_symbol: "NSD1",
              selectivity_feasibility: 0.7,
              rationale: "Methyltransferase",
            },
          ],
        },
      ],
    });
    assert.equal(
      resolveTitle(opp),
      "Oncogene-negative refractory tumors may respond to NSD1 methyltransferase inhibition."
    );
  });
});
