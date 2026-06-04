import test from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeScientificClaim,
  sanitizeHypothesisFields,
  withScientificWritingRules,
} from "./scientificLanguage";

test("fixes bare agonism to agonist", () => {
  assert.equal(
    sanitizeScientificClaim("TLR7 agonism may have therapeutic potential"),
    "TLR7 agonist may have therapeutic potential"
  );
});

test("fixes target-is-approved without intervention class", () => {
  assert.equal(
    sanitizeScientificClaim("TLR7 is approved for hepatitis B"),
    "A TLR7 agonist is approved for hepatitis B"
  );
});

test("preserves reverse agonism mechanistic term", () => {
  const input = "Evidence supports reverse agonism at the receptor level";
  assert.equal(sanitizeScientificClaim(input), input);
});

test("preserves partial agonism mechanistic term", () => {
  const input = "Partial agonism at TLR7 may modulate IFN response";
  assert.equal(sanitizeScientificClaim(input), input);
});

test("fixes JAK target approval phrasing", () => {
  assert.match(
    sanitizeScientificClaim("JAK1 is approved for rheumatoid arthritis"),
    /JAK inhibitor is approved/
  );
});

test("sanitizeHypothesisFields sanitizes all fields", () => {
  const result = sanitizeHypothesisFields({
    statement: "TLR7 is approved for lupus",
    patient_population: "SLE patients",
    unmet_need: "TLR7 agonism remains understudied",
    org_positioning: "Portfolio fit",
  });
  assert.match(result.statement, /TLR7 agonist is approved/);
  assert.match(result.unmet_need, /TLR7 agonist/);
});

test("withScientificWritingRules appends rules block", () => {
  const out = withScientificWritingRules("Base prompt.");
  assert.match(out, /Base prompt\./);
  assert.match(out, /Entity precision/);
  assert.match(out, /TLR7 agonist is approved/);
});
