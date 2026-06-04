"use client";

import type { ActionabilityZone } from "@/types/OpportunityObject";
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
}

export function ScoreStrip({ confidenceScore, actionabilityZone }: ScoreStripProps) {
  const zone = ZONE_CONFIG[actionabilityZone];

  return (
    <div className="flex items-center justify-between rounded-lg border border-[#EDE8E0] bg-white px-4 py-3">
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-medium text-gray-500">Confidence</span>
        <span className="text-lg font-semibold tabular-nums text-gray-900">
          {confidenceScore.toFixed(2)}
        </span>
      </div>
      <span className="text-gray-300">|</span>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-500">Actionability</span>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-semibold",
            zone.pillClass
          )}
        >
          {zone.label}
        </span>
      </div>
    </div>
  );
}
