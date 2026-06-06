import assert from "node:assert/strict";
import { test } from "node:test";
import {
  evaluateTargetAlignment,
  extractDeclaredEntities,
  filterAlignedTargets,
} from "./hypothesisTargetAlign";
import type { RankedTarget } from "./targetList";

test("extractDeclaredEntities finds ESR2 from ER beta antagonist thesis", () => {
  const entities = extractDeclaredEntities(
    "Microglial-selective estrogen receptor beta antagonists for autoimmune CNS disease"
  );
  assert.ok(entities.includes("ESR2"));
});

test("evaluateTargetAlignment flags CNST mismatch for ER beta thesis", () => {
  const targets: RankedTarget[] = [
    {
      target_name: "Connexin 36",
      gene_symbol: "GJD2",
      structural_druggability: 0.4,
      pathway_confidence: 0.3,
      clinical_novelty: 0.6,
      safety_precedent: 0.5,
      druggability_composite: 0.43,
      priority_rank: 1,
      rationale: "test",
      recommended_modality: "small molecule",
      key_risk: "test",
    },
  ];
  const result = evaluateTargetAlignment(
    "Estrogen receptor beta antagonists for neuroinflammation",
    targets
  );
  assert.equal(result.status, "mismatch");
});

test("filterAlignedTargets prefers declared entity targets", () => {
  const targets: RankedTarget[] = [
    {
      target_name: "Connexin",
      gene_symbol: "GJD2",
      structural_druggability: 0.5,
      pathway_confidence: 0.5,
      clinical_novelty: 0.5,
      safety_precedent: 0.5,
      druggability_composite: 0.5,
      priority_rank: 1,
      rationale: "a",
      recommended_modality: "small molecule",
      key_risk: "r",
    },
    {
      target_name: "ESR2",
      gene_symbol: "ESR2",
      structural_druggability: 0.6,
      pathway_confidence: 0.6,
      clinical_novelty: 0.6,
      safety_precedent: 0.6,
      druggability_composite: 0.6,
      priority_rank: 2,
      rationale: "b",
      recommended_modality: "small molecule",
      key_risk: "r",
    },
  ];
  const filtered = filterAlignedTargets(
    "Estrogen receptor beta antagonist hypothesis",
    targets
  );
  assert.equal(filtered[0].gene_symbol, "ESR2");
});
