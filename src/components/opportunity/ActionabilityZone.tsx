"use client";

import type { ActionabilityZone } from "@/types/OpportunityObject";
import { cn } from "@/lib/utils";

const ZONE_CONFIG: Record<
  ActionabilityZone,
  { label: string; description: string; color: string }
> = {
  too_early: {
    label: "Too early",
    description: "Evidence thin — monitor",
    color: "text-brand-coral",
  },
  act_now: {
    label: "Act now",
    description: "Substantive evidence",
    color: "text-brand-teal",
  },
  crowded: {
    label: "Crowded",
    description: "Competitive audit — assess differentiation window.",
    color: "text-brand-amber",
  },
};

interface ActionabilityZoneProps {
  zone: ActionabilityZone;
  score: number;
}

export function ActionabilityZoneBar({ zone, score }: ActionabilityZoneProps) {
  const config = ZONE_CONFIG[zone];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">Actionability</span>
        <span className={cn("text-xs font-semibold", config.color)}>
          {config.label}
        </span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-gray-100">
        <div className="absolute inset-0 flex">
          <div className="w-1/3 bg-brand-coral/20" />
          <div className="w-1/3 bg-brand-teal/20" />
          <div className="w-1/3 bg-brand-amber/20" />
        </div>
        <div
          className={cn(
            "absolute top-0 h-full w-0.5 rounded-full",
            zone === "too_early"
              ? "bg-brand-coral"
              : zone === "act_now"
                ? "bg-brand-teal"
                : "bg-brand-amber"
          )}
          style={{ left: `${Math.min(Math.max(score * 100, 2), 98)}%` }}
        />
      </div>
      <p className="text-[11px] text-gray-400">{config.description}</p>
    </div>
  );
}
