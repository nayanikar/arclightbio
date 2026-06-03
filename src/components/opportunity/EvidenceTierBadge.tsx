import type { EvidenceTier } from "@/types/OpportunityObject";
import { tierDisplayLabel } from "@/lib/evidenceTier";
import { cn } from "@/lib/utils";

const TIER_STYLES: Record<EvidenceTier, string> = {
  preclinical: "bg-brand-coral/10 text-brand-coral border-brand-coral/20",
  clinical: "bg-brand-amber/10 text-brand-amber border-brand-amber/20",
  established: "bg-brand-teal/10 text-brand-teal border-brand-teal/20",
};

export function EvidenceTierBadge({
  tier,
  className,
}: {
  tier: EvidenceTier;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium capitalize",
        TIER_STYLES[tier],
        className
      )}
    >
      {tierDisplayLabel(tier)}
    </span>
  );
}
