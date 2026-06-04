import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BLACKBOARD_STEPS,
  isBlackboardComplete,
  isBlackboardPausedMidRun,
  acquireBlackboardLock,
} from "./blackboardRun";

describe("blackboardRun checkpoint helpers", () => {
  it("isBlackboardComplete when all steps are recorded", () => {
    assert.equal(
      isBlackboardComplete({ completedSteps: [...BLACKBOARD_STEPS] }),
      true
    );
    assert.equal(isBlackboardComplete({ completedSteps: ["literature"] }), false);
    assert.equal(isBlackboardComplete(undefined), false);
  });

  it("isBlackboardPausedMidRun only for incomplete user-stopped runs", () => {
    assert.equal(
      isBlackboardPausedMidRun({
        completedSteps: ["regulatory:early", "literature"],
        pauseReason: "user_stopped",
      }),
      true
    );
    assert.equal(
      isBlackboardPausedMidRun({
        completedSteps: [...BLACKBOARD_STEPS],
        pauseReason: "user_stopped",
      }),
      false
    );
    assert.equal(
      isBlackboardPausedMidRun({
        completedSteps: ["literature"],
        pauseReason: "surveillance",
      }),
      false
    );
  });
});

describe("blackboardRun lock", () => {
  it("rejects concurrent lock on same opportunity", async () => {
    const id = `test-lock-${Date.now()}`;
    const first = await acquireBlackboardLock(id);
    assert.equal(first.acquired, true);

    const second = await acquireBlackboardLock(id);
    assert.equal(second.acquired, false);

    await first.release();

    const third = await acquireBlackboardLock(id);
    assert.equal(third.acquired, true);
    await third.release();
  });
});
