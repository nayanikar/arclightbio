import type { ActionabilityZone } from "@/types/OpportunityObject";
import { cn } from "@/lib/utils";

const ZONE_LABELS: Record<ActionabilityZone, string> = {
  act_now: "Act now",
  too_early: "Too early",
  crowded: "Crowded",
};

const ZONE_CLASSES: Record<ActionabilityZone, string> = {
  act_now: "zone-act",
  too_early: "zone-early",
  crowded: "zone-crowd",
};

interface ZoneBadgeProps {
  zone: ActionabilityZone;
  className?: string;
}

export function ZoneBadge({ zone, className }: ZoneBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md px-2.5 py-1 text-xs font-semibold tracking-wide",
        ZONE_CLASSES[zone],
        className
      )}
    >
      {ZONE_LABELS[zone]}
    </span>
  );
}
