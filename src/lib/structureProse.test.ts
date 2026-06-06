import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { structureLongText } from "./structureProse";

describe("structureProse", () => {
  it("splits long text into summary and bullets", () => {
    const text =
      "Primary takeaway sentence. Second sentence adds mechanism. Third covers risk. Fourth describes precedent.";
    const result = structureLongText(text);
    assert.equal(result.summary, "Primary takeaway sentence.");
    assert.ok(result.key_points.length >= 2);
  });
});
