import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countWords, isWithinWordLimit, HEADLINE_MAX_WORDS } from "./headlineProse";

describe("headlineProse", () => {
  it("counts words", () => {
    assert.equal(countWords("one two three"), 3);
    assert.equal(countWords(""), 0);
  });

  it("checks headline budget", () => {
    const sentence = "word ".repeat(HEADLINE_MAX_WORDS).trim();
    assert.equal(isWithinWordLimit(sentence), true);
    assert.equal(isWithinWordLimit(`${sentence} extra`), false);
  });
});
