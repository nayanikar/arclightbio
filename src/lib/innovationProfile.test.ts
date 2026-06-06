import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  biologyRecurrenceBand,
  getInnovationTemperature,
  normalizeInnovationLevel,
} from "@/lib/innovationProfile";

describe("innovationProfile", () => {
  it("normalizeInnovationLevel defaults to medium", () => {
    assert.equal(normalizeInnovationLevel(undefined), "medium");
    assert.equal(normalizeInnovationLevel("invalid"), "medium");
  });

  it("getInnovationTemperature increases with risk level", () => {
    assert.ok(
      getInnovationTemperature("highest", "generate") >
        getInnovationTemperature("lowest", "generate")
    );
    assert.ok(
      getInnovationTemperature("medium", "filter") >
        getInnovationTemperature("lowest", "filter")
    );
  });

  it("biologyRecurrenceBand widens for highest innovation", () => {
    const low = biologyRecurrenceBand("lowest");
    const high = biologyRecurrenceBand("highest");
    assert.ok(high.min < low.min);
    assert.ok(high.max <= low.max);
  });
});
