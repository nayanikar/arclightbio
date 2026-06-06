"use client";

import type { ActionabilityZone } from "@/types/OpportunityObject";
import type { ScoreDecomposition } from "@/lib/scoreDecomposition";
import { ScoreDecompositionTooltip } from "@/components/opportunity/ScoreDecompositionTooltip";
import { cn } from "@/lib/utils";

const ZONE_CONFIG: Record<
  ActionabilityZone,
  { label: string; pillClass: string }
> = {
  act_now: { label: "Act Now", pillClass: "zone-act" },
  too_early: { label: "Too Early", pillClass: "zone-early" },
  crowded: { label: "Crowded", pillClass: "zone-crowd" },
};

interface ScoreStripProps {
  confidenceScore: number;
  actionabilityZone: ActionabilityZone;
  scoreDecomposition?: ScoreDecomposition | null;
}

export function ScoreStrip({
  confidenceScore,
  actionabilityZone,
  scoreDecomposition,
}: ScoreStripProps) {
  const zone = ZONE_CONFIG[actionabilityZone];

  return (
    <div
      className="space-y-4 rounded-xl border bg-white p-4"
      style={{ borderColor: "var(--color-border-tertiary)" }}
    >
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className="text-xs font-medium uppercase tracking-wide"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Confidence
          </span>
          <ScoreDecompositionTooltip
            decomposition={scoreDecomposition}
            confidenceScore={confidenceScore}
          />
        </div>
        <p
          className="text-2xl font-semibold tabular-nums tracking-tight"
          style={{ color: "var(--color-text-primary)" }}
        >
          {confidenceScore.toFixed(2)}
        </p>
      </div>

      <div
        className="border-t pt-3"
        style={{ borderColor: "var(--color-border-tertiary)" }}
      >
        <span
          className="text-xs font-medium uppercase tracking-wide"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          Actionability
        </span>
        <div className="mt-2">
          <span
            className={cn(
              "inline-flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold",
              zone.pillClass
            )}
          >
            {zone.label}
          </span>
        </div>
      </div>
    </div>
  );
}
