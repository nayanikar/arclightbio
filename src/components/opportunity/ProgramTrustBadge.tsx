"use client";

import { useState } from "react";
import type { ProgramTrustBreakdown } from "@/types/V3Pipeline";
import { PROGRAM_TRUST_LABELS } from "@/lib/programTrustScore";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

interface ProgramTrustBadgeProps {
  score: number | null | undefined;
  breakdown?: ProgramTrustBreakdown | null;
  variant?: "header" | "sidebar";
  className?: string;
}

function metricBar(label: string, value: number, accent: string) {
  const pct = Math.round(value * 100);
  return (
    <div key={label}>
      <div className="mb-1 flex justify-between text-[10px]">
        <span style={{ color: "var(--color-text-tertiary)" }}>{label}</span>
        <span className="font-mono tabular-nums" style={{ color: "var(--v3-navy)" }}>
          {pct}%
        </span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full"
        style={{ background: "rgba(15,26,46,0.08)" }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: accent }}
        />
      </div>
    </div>
  );
}

export function ProgramTrustBadge({
  score,
  breakdown,
  variant = "header",
  className,
}: ProgramTrustBadgeProps) {
  const [expanded, setExpanded] = useState(false);

  if (score == null || Number.isNaN(score)) return null;

  const pct = Math.round(score * 100);
  const label = breakdown?.label ?? (score >= 0.7 ? "strong" : score >= 0.45 ? "moderate" : "exploratory");
  const meta = PROGRAM_TRUST_LABELS[label];
  const accent = label === "strong" ? "var(--v3-teal)" : label === "moderate" ? "var(--v3-amber)" : "var(--color-text-tertiary)";

  const isHeader = variant === "header";

  return (
    <div
      className={cn(
        "rounded-lg border",
        isHeader ? "border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm" : "px-3 py-3",
        !isHeader && "border-[rgba(15,26,46,0.1)] bg-white/80",
        className
      )}
      style={!isHeader ? { background: "var(--v3-paper)" } : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className="font-mono text-[10px] uppercase tracking-widest"
            style={{ color: isHeader ? "rgba(248,245,239,0.6)" : "var(--v3-teal)" }}
          >
            Discovery confidence
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={cn(
                "font-display font-semibold tabular-nums",
                isHeader ? "text-2xl" : "text-xl"
              )}
              style={{ color: isHeader ? "#f8f5ef" : accent }}
            >
              {pct}%
            </span>
            <span
              className="text-xs font-medium"
              style={{ color: isHeader ? "rgba(248,245,239,0.75)" : "var(--color-text-secondary)" }}
            >
              {meta.title}
            </span>
          </div>
          <p
            className="mt-1 text-xs leading-relaxed"
            style={{ color: isHeader ? "rgba(248,245,239,0.65)" : "var(--color-text-tertiary)" }}
          >
            {meta.description}
          </p>
        </div>
        {breakdown && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className={cn(
              "flex shrink-0 items-center gap-0.5 rounded-md px-2 py-1 text-[10px] font-medium transition-colors",
              isHeader ? "text-white/70 hover:bg-white/10" : "hover:bg-black/5"
            )}
            style={{ color: isHeader ? undefined : "var(--color-text-tertiary)" }}
            aria-expanded={expanded}
          >
            Breakdown
            <ChevronDown className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} />
          </button>
        )}
      </div>

      {expanded && breakdown && (
        <div className={cn("mt-3 space-y-2.5 border-t pt-3", isHeader && "border-white/15")}>
          {metricBar("Funnel coverage", breakdown.funnel_coverage, "var(--v3-teal)")}
          {metricBar("Evidence strength", breakdown.evidence_strength, "var(--v3-amber)")}
          {metricBar("Biology signal", breakdown.biology_signal, "var(--v3-teal-light)")}
        </div>
      )}
    </div>
  );
}
