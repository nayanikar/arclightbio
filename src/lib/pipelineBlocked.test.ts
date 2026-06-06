import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  blockedReason,
  isPipelineBlocked,
  isPrimaryUndruggable,
} from "./pipelineBlocked";
import type { DrugDiscoveryAssessment } from "@/types/V3Pipeline";

describe("pipelineBlocked", () => {
  it("detects blocked from pipeline_status", () => {
    const assessment: DrugDiscoveryAssessment = {
      drug_exists: false,
      branch: "new",
      pipeline_status: "blocked_undruggable",
    };
    assert.equal(isPipelineBlocked(assessment, [], "HK2"), true);
  });

  it("detects blocked when primary is in undruggable registry (legacy null status)", () => {
    assert.equal(
      isPipelineBlocked(
        { drug_exists: false, branch: "new", druggability_score: 0.72 },
        [{ target_name: "HK2", reasoning: "Undruggable enzyme" }],
        "HK2"
      ),
      true
    );
  });

  it("isPrimaryUndruggable matches registry entries", () => {
    assert.equal(
      isPrimaryUndruggable("SLC2A1", [{ target_name: "SLC2A1" }]),
      true
    );
  });

  it("blockedReason prefers assessment blocked_reason", () => {
    const reason = blockedReason(
      {
        drug_exists: false,
        branch: "new",
        blocked_reason: "All modalities failed",
      },
      [],
      null
    );
    assert.equal(reason, "All modalities failed");
  });
});
