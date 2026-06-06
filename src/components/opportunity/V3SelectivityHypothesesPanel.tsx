"use client";

import type { HypothesisRecord } from "@/types/OpportunityObject";
import { V3Panel } from "@/components/opportunity/v3/V3Panel";
import { cn } from "@/lib/utils";

interface V3SelectivityHypothesesPanelProps {
  hypotheses: HypothesisRecord[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  className?: string;
}

export function V3SelectivityHypothesesPanel({
  hypotheses,
  selectedId,
  onSelect,
  className,
}: V3SelectivityHypothesesPanelProps) {
  const top3 = hypotheses
    .filter((h) => !h.is_outgroup)
    .filter(
      (h) =>
        h.hypothesis_stage === "selectivity" ||
        (h.rank != null && h.rank <= 3)
    )
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
    .slice(0, 3);

  return (
    <V3Panel
      title="Top 3 selectivity hypotheses"
      description="Ranked by anchor fidelity, evidence strength, and selectivity feasibility"
      className={className}
      accent
    >
      {top3.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>
          Selectivity ranking completes after causation filter
        </p>
      ) : (
        <div className="space-y-3">
          {top3.map((h) => {
            const selected = h.id === selectedId;
            return (
              <button
                key={h.id}
                type="button"
                onClick={() => onSelect?.(h.id)}
                className={cn(
                  "w-full rounded-lg border px-4 py-3 text-left transition-all",
                  selected
                    ? "border-[var(--v3-teal)] bg-[rgba(26,107,99,0.06)] ring-1 ring-[var(--v3-teal)]/20"
                    : "border-[rgba(15,26,46,0.08)] bg-white/60 hover:border-[var(--v3-teal)]/30",
                  onSelect ? "cursor-pointer" : "cursor-default"
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full font-mono text-xs font-bold"
                    style={{
                      background: selected ? "var(--v3-teal)" : "var(--v3-amber-glow)",
                      color: selected ? "#fff" : "var(--v3-amber)",
                    }}
                  >
                    {h.rank ?? "—"}
                  </span>
                  {h.hypothesis_stage && (
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide"
                      style={{
                        background: "rgba(15, 26, 46, 0.06)",
                        color: "var(--v3-navy)",
                      }}
                    >
                      {h.hypothesis_stage}
                    </span>
                  )}
                </div>
                <p
                  className="mt-2 font-display text-sm font-semibold leading-snug"
                  style={{ color: "var(--v3-navy)" }}
                >
                  {h.statement}
                </p>
                {h.ranking_rationale && (
                  <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                    <span className="font-mono text-[10px] uppercase tracking-wide" style={{ color: "var(--v3-amber)" }}>
                      Rationale
                    </span>
                    <span className="mt-1 block">{h.ranking_rationale}</span>
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </V3Panel>
  );
}
