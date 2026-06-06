"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { V3AuditTrailTimeline } from "@/components/opportunity/V3AuditTrailTimeline";
import { filterTrailForHypothesis } from "@/lib/trailLabels";
import { useOpportunityStore } from "@/store/opportunityStore";
import { cn } from "@/lib/utils";

export function V3AuditTrailPanel({ hypothesisId }: { hypothesisId?: string }) {
  const [expanded, setExpanded] = useState(false);
  const { trailEntries, isStreaming } = useOpportunityStore();

  const count = useMemo(() => {
    const filtered = filterTrailForHypothesis(trailEntries, hypothesisId);
    return filtered.filter((e) => e.kind !== "started").length;
  }, [trailEntries, hypothesisId]);

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        borderColor: "rgba(15, 26, 46, 0.12)",
        background: "var(--v3-paper)",
      }}
    >
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-black/[0.02]"
      >
        <div>
          <p
            className="font-mono text-[10px] uppercase tracking-widest"
            style={{ color: "var(--v3-teal)" }}
          >
            Audit trail
          </p>
          <p className="mt-0.5 text-xs" style={{ color: "var(--color-text-secondary)" }}>
            Evidence, sources & agent reasoning
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="rounded-full px-2 py-0.5 font-mono text-[10px] tabular-nums"
            style={{
              background: "rgba(26, 107, 99, 0.1)",
              color: "var(--v3-teal)",
            }}
          >
            {count}
            {isStreaming ? "+" : ""}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 transition-transform duration-200",
              expanded && "rotate-180"
            )}
            style={{ color: "var(--color-text-tertiary)" }}
          />
        </div>
      </button>

      {expanded && (
        <div
          className="flex min-h-0 flex-col border-t px-4 pb-4 pt-2"
          style={{ borderColor: "rgba(15, 26, 46, 0.08)" }}
        >
          <V3AuditTrailTimeline hypothesisId={hypothesisId} />
        </div>
      )}
    </div>
  );
}
