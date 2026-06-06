"use client";

import type { DashboardSortKey } from "@/lib/dashboardDisplay";
import { cn } from "@/lib/utils";

const SORT_OPTIONS: { key: DashboardSortKey; label: string }[] = [
  { key: "confidence", label: "Confidence" },
  { key: "recency", label: "Recency" },
  { key: "phase", label: "Phase" },
];

interface ProgramQueueToolbarProps {
  sortKey: DashboardSortKey;
  onSortChange: (key: DashboardSortKey) => void;
  count: number;
}

export function ProgramQueueToolbar({
  sortKey,
  onSortChange,
  count,
}: ProgramQueueToolbarProps) {
  const programLabel =
    count === 1 ? "1 discovery program" : `${count} discovery programs`;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-baseline gap-2">
        <h2
          className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: "var(--v3-teal)" }}
        >
          Program queue
        </h2>
        <span
          className="text-xs"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          · {programLabel}
        </span>
      </div>

      <div
        className="inline-flex rounded-lg border p-0.5"
        role="group"
        aria-label="Sort programs by"
        style={{
          borderColor: "rgba(15, 26, 46, 0.12)",
          background: "rgba(255, 255, 255, 0.6)",
        }}
      >
        {SORT_OPTIONS.map(({ key, label }) => {
          const active = sortKey === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSortChange(key)}
              aria-pressed={active}
              className={cn(
                "rounded-md px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--v3-teal)]"
              )}
              style={
                active
                  ? {
                      background: "var(--v3-teal)",
                      color: "#fff",
                    }
                  : {
                      color: "var(--color-text-secondary)",
                    }
              }
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
