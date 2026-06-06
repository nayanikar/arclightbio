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

const TIER_ACCENT: Record<string, { score: string; pill: string; pillText: string }> = {
  strong: {
    score: "var(--v3-teal-light)",
    pill: "rgba(42, 157, 143, 0.2)",
    pillText: "var(--v3-teal-light)",
  },
  moderate: {
    score: "var(--v3-amber)",
    pill: "rgba(196, 132, 45, 0.22)",
    pillText: "var(--v3-amber)",
  },
  exploratory: {
    score: "rgba(248, 245, 239, 0.92)",
    pill: "rgba(248, 245, 239, 0.12)",
    pillText: "rgba(248, 245, 239, 0.85)",
  },
};

const METRIC_LABELS: Array<{
  key: keyof Pick<
    ProgramTrustBreakdown,
    "funnel_coverage" | "evidence_strength" | "biology_signal"
  >;
  short: string;
  accent: string;
}> = [
  { key: "funnel_coverage", short: "Funnel", accent: "var(--v3-teal-light)" },
  { key: "evidence_strength", short: "Evidence", accent: "var(--v3-amber)" },
  { key: "biology_signal", short: "Biology", accent: "var(--v3-teal)" },
];

function MetricRow({
  label,
  value,
  accent,
  onDark,
}: {
  label: string;
  value: number;
  accent: string;
  onDark: boolean;
}) {
  const pct = Math.round(value * 100);

  return (
    <div className="grid grid-cols-[4.5rem_1fr_2.25rem] items-center gap-2">
      <span
        className="font-mono text-[10px] uppercase tracking-wide"
        style={{ color: onDark ? "rgba(248,245,239,0.55)" : "var(--color-text-tertiary)" }}
      >
        {label}
      </span>
      <div
        className="h-1 overflow-hidden rounded-full"
        style={{
          background: onDark ? "rgba(248,245,239,0.12)" : "rgba(15, 26, 46, 0.08)",
        }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: accent }}
        />
      </div>
      <span
        className="text-right font-mono text-[11px] tabular-nums"
        style={{ color: onDark ? "rgba(248,245,239,0.9)" : "var(--v3-navy)" }}
      >
        {pct}%
      </span>
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
  const tierKey =
    breakdown?.label ??
    (score >= 0.7 ? "strong" : score >= 0.45 ? "moderate" : "exploratory");
  const meta = PROGRAM_TRUST_LABELS[tierKey];
  const isHeader = variant === "header";
  const tierStyle = TIER_ACCENT[tierKey] ?? TIER_ACCENT.exploratory;

  const labelMuted = isHeader
    ? "rgba(248,245,239,0.5)"
    : "var(--color-text-tertiary)";
  const bodyText = isHeader ? "rgba(248,245,239,0.95)" : "var(--v3-navy)";
  const hintText = isHeader
    ? "rgba(248,245,239,0.55)"
    : "var(--color-text-secondary)";

  const scoreColor = isHeader
    ? tierStyle.score
    : tierKey === "strong"
      ? "var(--v3-teal)"
      : tierKey === "moderate"
        ? "var(--v3-amber)"
        : "var(--v3-navy)";

  return (
    <div
      className={cn(
        "rounded-lg border",
        isHeader
          ? "border-white/12 bg-white/[0.08] px-4 py-3.5 backdrop-blur-sm"
          : "border-[rgba(15,26,46,0.1)] bg-white/80 px-3 py-3",
        className
      )}
      style={!isHeader ? { background: "var(--v3-paper)" } : undefined}
      aria-label={`Discovery confidence score ${pct} percent, ${meta.tier} tier`}
    >
      {/* Header row — label and action balanced across full width */}
      <div className="flex items-center justify-between gap-3">
        <p
          className="font-mono text-[10px] font-medium uppercase tracking-[0.14em]"
          style={{ color: labelMuted }}
        >
          Discovery confidence
        </p>
        {breakdown && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className={cn(
              "flex shrink-0 items-center gap-0.5 rounded-md border px-2 py-1 text-[10px] font-medium uppercase tracking-wide transition-colors",
              isHeader
                ? "border-white/15 text-white/70 hover:border-white/25 hover:bg-white/10 hover:text-white"
                : "border-[rgba(15,26,46,0.1)] text-[var(--color-text-tertiary)] hover:bg-black/5"
            )}
            aria-expanded={expanded}
          >
            Details
            <ChevronDown
              className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")}
            />
          </button>
        )}
      </div>

      {/* Score + tier — two balanced columns */}
      <div className="mt-3 flex items-stretch gap-3">
        <div
          className="flex min-w-[4.5rem] flex-col items-center justify-center rounded-md border px-3 py-2"
          style={{
            borderColor: isHeader ? "rgba(248,245,239,0.15)" : "rgba(15,26,46,0.1)",
            background: isHeader ? "rgba(248,245,239,0.06)" : "rgba(15,26,46,0.03)",
          }}
        >
          <span
            className="font-display text-[1.75rem] font-semibold tabular-nums leading-none"
            style={{ color: scoreColor }}
          >
            {pct}%
          </span>
        </div>

        <div
          className="flex min-w-0 flex-1 flex-col justify-center border-l pl-3"
          style={{
            borderColor: isHeader ? "rgba(248,245,239,0.12)" : "rgba(15,26,46,0.08)",
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="text-xs font-medium"
              style={{ color: bodyText }}
            >
              Tier
            </span>
            <span
              className="rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide"
              style={{
                background: isHeader ? tierStyle.pill : `${tierStyle.pill}`,
                color: isHeader ? tierStyle.pillText : scoreColor,
              }}
            >
              {meta.tier}
            </span>
          </div>
          <p className="mt-1.5 text-xs leading-snug" style={{ color: hintText }}>
            {meta.hint}
          </p>
        </div>
      </div>

      {expanded && breakdown && (
        <div
          className={cn(
            "mt-3 space-y-2 border-t pt-3",
            isHeader ? "border-white/12" : "border-[rgba(15,26,46,0.08)]"
          )}
        >
          <p
            className="mb-2 font-mono text-[9px] uppercase tracking-wide"
            style={{ color: labelMuted }}
          >
            What drives the score
          </p>
          {METRIC_LABELS.map(({ key, short, accent: barAccent }) => (
            <MetricRow
              key={key}
              label={short}
              value={breakdown[key]}
              accent={barAccent}
              onDark={isHeader}
            />
          ))}
        </div>
      )}
    </div>
  );
}
