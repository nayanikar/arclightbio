import type { OpportunityObject } from "@/types/OpportunityObject";
import { parentDomainLabel } from "@/lib/parentDomains";
import { humanizeStep } from "@/lib/trailLabels";
import { cn } from "@/lib/utils";

interface OpportunityMetaBadgesProps {
  opportunity: OpportunityObject;
  className?: string;
}

export function OpportunityMetaBadges({
  opportunity,
  className,
}: OpportunityMetaBadgesProps) {
  const schemaVersion = opportunity.schema_version ?? 1;
  const hypothesisCount = opportunity.hypotheses?.length;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {schemaVersion === 3 && opportunity.parent_domain && (
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.04em]"
          style={{
            background: "rgba(26, 107, 99, 0.1)",
            color: "#1A6B63",
          }}
        >
          {parentDomainLabel(opportunity.parent_domain)}
        </span>
      )}
      {schemaVersion === 2 && (
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.04em]"
          style={{
            background: "rgba(83, 74, 183, 0.08)",
            color: "#534AB7",
          }}
        >
          v2
          {typeof hypothesisCount === "number" && hypothesisCount > 0
            ? ` · ${hypothesisCount} hyps`
            : ""}
        </span>
      )}
      {schemaVersion === 3 && opportunity.v3_phase && (
        <span
          className="max-w-[140px] truncate rounded px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide"
          style={{
            background: "rgba(26, 107, 99, 0.1)",
            color: "var(--v3-teal)",
          }}
          title={humanizeStep(opportunity.v3_phase)}
        >
          {humanizeStep(opportunity.v3_phase)}
        </span>
      )}
      {opportunity.status === "paused" && (
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-medium"
          style={{
            background: "rgba(196, 132, 45, 0.12)",
            color: "var(--v3-amber)",
          }}
        >
          Paused
        </span>
      )}
      {opportunity.status === "agents_running" && (
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-medium"
          style={{
            background: "rgba(26, 107, 99, 0.12)",
            color: "var(--v3-teal)",
          }}
        >
          Running
        </span>
      )}
      {opportunity.status === "agents_failed" && (
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-medium"
          style={{
            background: "rgba(216, 90, 48, 0.1)",
            color: "#D85A30",
          }}
        >
          Failed
        </span>
      )}
    </div>
  );
}
