import assert from "node:assert/strict";
import { test } from "node:test";

// Minimal copies of helpers under test (avoid exporting private fns from agent)
function formatNoveltyVerdict(
  verdicts: Array<{
    target?: string;
    verdict?: string;
    confidence?: number;
    novelty_statement?: string;
    prior_art_found?: string[];
  }>
): string {
  return verdicts
    .map((v) => {
      const verdictLabel = (v.verdict ?? "uncertain").replace(/_/g, " ");
      const statement = v.novelty_statement ?? "Novelty assessment incomplete.";
      return `${v.target}: first-in-class assessment — ${verdictLabel} (confidence ${((v.confidence ?? 0) * 100).toFixed(0)}%) — ${statement}`;
    })
    .join("\n");
}

test("formatNoveltyVerdict handles missing verdict field from LLM", () => {
  const out = formatNoveltyVerdict([
    {
      target: "MECHANISM",
      confidence: 0.4,
      novelty_statement: "Test statement",
    },
  ]);
  assert.match(out, /uncertain/);
  assert.match(out, /Test statement/);
});
