"use client";

import { humanizeStep } from "@/lib/trailLabels";
import { parentDomainLabel } from "@/lib/parentDomains";
import type { OpportunityStatus } from "@/types/OpportunityObject";
import type { InnovationLevel, ParentDomain } from "@/types/V3Pipeline";
import { innovationLevelLabel } from "@/lib/innovationProfile";
import { cn } from "@/lib/utils";

function Pill({
  children,
  accent = "neutral",
  className,
}: {
  children: React.ReactNode;
  accent?: "teal" | "amber" | "neutral" | "live";
  className?: string;
}) {
  const styles = {
    teal: {
      border: "rgba(26, 107, 99, 0.35)",
      bg: "rgba(26, 107, 99, 0.15)",
      color: "rgba(200, 240, 232, 0.95)",
    },
    amber: {
      border: "rgba(196, 132, 45, 0.35)",
      bg: "rgba(196, 132, 45, 0.12)",
      color: "rgba(255, 220, 170, 0.95)",
    },
    live: {
      border: "rgba(72, 220, 180, 0.45)",
      bg: "rgba(26, 107, 99, 0.22)",
      color: "#d4f5ee",
    },
    neutral: {
      border: "rgba(248, 245, 239, 0.18)",
      bg: "rgba(255, 255, 255, 0.08)",
      color: "rgba(248, 245, 239, 0.75)",
    },
  }[accent];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide",
        className
      )}
      style={{
        borderColor: styles.border,
        background: styles.bg,
        color: styles.color,
      }}
    >
      {children}
    </span>
  );
}

export function V3SessionMetaPills({
  status,
  v3Phase,
  parentDomain,
  cohortLinked,
  innovationLevel,
}: {
  status: OpportunityStatus;
  v3Phase?: string | null;
  parentDomain?: ParentDomain | null;
  cohortLinked?: boolean;
  innovationLevel?: InnovationLevel | null;
}) {
  const isRunning = status === "agents_running";
  const statusLabel = status.replace(/_/g, " ");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Pill accent={isRunning ? "live" : status === "paused" ? "amber" : "neutral"}>
        {isRunning && (
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-300/80 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-teal-200" />
          </span>
        )}
        {statusLabel}
      </Pill>
      {v3Phase && <Pill accent="teal">{humanizeStep(v3Phase)}</Pill>}
      {parentDomain && (
        <Pill accent="amber">{parentDomainLabel(parentDomain)}</Pill>
      )}
      {cohortLinked && <Pill accent="neutral">Cohort linked</Pill>}
      {innovationLevel && (
        <Pill accent="amber">{innovationLevelLabel(innovationLevel)}</Pill>
      )}
    </div>
  );
}
