import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BLACKBOARD_V2_STEPS, isBlackboardV2Complete } from "./blackboardRunV2";

describe("blackboardRunV2", () => {
  it("isBlackboardV2Complete when all v2 steps recorded", () => {
    assert.equal(
      isBlackboardV2Complete({ completedSteps: [...BLACKBOARD_V2_STEPS] }),
      true
    );
    assert.equal(
      isBlackboardV2Complete({ completedSteps: ["stage1:literature"] }),
      false
    );
  });
});
