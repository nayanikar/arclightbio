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

  it("assigns sessionLabel when duplicate queries exist", () => {
    const sharedQuery = "cancer patients without dominant oncogenic mutation";
    const views = buildDashboardProgramViews([
      baseOpp({ id: "aaaaaaaa-bbbb-cccc-dddd-111111111111", search_query: sharedQuery }),
      baseOpp({ id: "bbbbbbbb-bbbb-cccc-dddd-222222222222", search_query: sharedQuery }),
    ]);
    assert.equal(views[0].sessionLabel, "1111");
    assert.equal(views[1].sessionLabel, "2222");
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

  it("toDashboardProgramView omits sessionLabel for unique queries", () => {
    const view = toDashboardProgramView(baseOpp(), new Set());
    assert.equal(view.sessionLabel, null);
  });

  it("resolveTitle prefers discovery_thesis_title from cache snapshot", () => {
    const opp = baseOpp({
      schema_version: 3,
      program_hypothesis_sentence: "Short program sentence",
      discovery_thesis_title:
        "Warburg program — proposed intervention: SLC2A1 (targeted intervention)",
      hypotheses: [
        {
          id: "h1",
          opportunity_object_id: "aaaaaaaa-bbbb-cccc-dddd-111111111111",
          rank: 1,
          is_outgroup: false,
          statement: "HK2 drives Warburg metabolism",
          patient_population: "",
          unmet_need: "",
          org_positioning: "",
          hypothesis_stage: "selectivity",
          ranked_targets: [
            {
              rank: 1,
              target_name: "SLC2A1",
              gene_symbol: "SLC2A1",
              selectivity_feasibility: 0.7,
              rationale: "GLUT1",
            },
          ],
        },
      ],
    });
    assert.match(resolveTitle(opp), /proposed intervention: SLC2A1/);
  });
});
