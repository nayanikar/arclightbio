import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  partitionScreenResults,
  type TargetScreenEntry,
} from "./targetDruggabilityGate";
import type { RankedTarget } from "@/types/V3Pipeline";

const ranked: RankedTarget[] = [
  {
    rank: 1,
    target_name: "HK2",
    gene_symbol: "HK2",
    selectivity_feasibility: 0.8,
    rationale: "Primary glycolytic node",
  },
  {
    rank: 2,
    target_name: "SLC2A1",
    gene_symbol: "SLC2A1",
    selectivity_feasibility: 0.6,
    rationale: "Glucose transporter",
  },
];

describe("targetDruggabilityGate", () => {
  it("partitions undruggable primary and re-ranks survivors", () => {
    const screen: TargetScreenEntry[] = [
      {
        target_name: "HK2",
        is_undruggable: true,
        failed_modalities: ["small_molecule", "biologic", "adc"],
        reasoning: "No tractable binding site across modalities",
        alternate_intervention: "Metabolic pathway modulation upstream",
      },
      {
        target_name: "SLC2A1",
        is_undruggable: false,
        failed_modalities: [],
        reasoning: "ADC path viable",
        alternate_intervention: null,
      },
    ];

    const result = partitionScreenResults(ranked, screen);
    assert.equal(result.undruggable.length, 1);
    assert.equal(result.undruggable[0].target_name, "HK2");
    assert.equal(result.druggable.length, 1);
    assert.equal(result.druggable[0].target_name, "SLC2A1");
    assert.equal(result.druggable[0].rank, 1);
    assert.equal(result.primaryTarget, "SLC2A1");
  });

  it("marks all-blocked when every target fails screen", () => {
    const screen: TargetScreenEntry[] = ranked.map((t) => ({
      target_name: t.target_name,
      is_undruggable: true,
      failed_modalities: ["small_molecule", "biologic", "adc"] as const,
      reasoning: "Infeasible",
      alternate_intervention: null,
    }));

    const result = partitionScreenResults(ranked, screen);
    assert.equal(result.druggable.length, 0);
    assert.equal(result.primaryTarget, null);
  });

  it("HK2-style: undruggable primary leaves no druggable path when alone", () => {
    const hk2Only: RankedTarget[] = [
      {
        rank: 1,
        target_name: "HK2",
        gene_symbol: "HK2",
        selectivity_feasibility: 0.72,
        rationale: "Warburg node",
      },
    ];
    const screen: TargetScreenEntry[] = [
      {
        target_name: "HK2",
        is_undruggable: true,
        failed_modalities: ["small_molecule", "biologic", "adc"],
        reasoning: "Undruggable metabolic enzyme",
        alternate_intervention: "Upstream metabolic regulator",
      },
    ];
    const result = partitionScreenResults(hk2Only, screen);
    assert.equal(result.druggable.length, 0);
    assert.equal(result.undruggable[0].target_name, "HK2");
  });
});
