"use client";

import type { DashboardMetrics } from "@/lib/dashboardDisplay";
import { cn } from "@/lib/utils";

interface PortfolioSummaryProps {
  metrics: DashboardMetrics;
  loading?: boolean;
  hydrated?: boolean;
}

interface MetricCellProps {
  label: string;
  value: string | number | null;
  accent?: "default" | "teal" | "amber" | "signal";
  delay?: number;
}

function MetricCell({ label, value, accent = "default", delay = 0 }: MetricCellProps) {
  const loading = value === null;
  const valueColor = {
    default: "var(--v3-navy)",
    teal: "var(--v3-teal)",
    amber: "var(--v3-amber)",
    signal: "#D85A30",
  }[accent];

  return (
    <div
      className="dashboard-metric-cell flex min-w-0 flex-col justify-center px-4 py-3"
      style={{ animationDelay: `${delay}ms` }}
    >
      <p
        className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em]"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        {label}
      </p>
      <p
        className={cn(
          "text-[26px] font-medium tabular-nums leading-none",
          loading && "min-h-[26px] min-w-[2ch] animate-pulse rounded"
        )}
        style={{
          color: loading ? "transparent" : valueColor,
          background: loading ? "rgba(15, 26, 46, 0.06)" : undefined,
        }}
        aria-hidden={loading}
      >
        {loading ? "0" : value}
      </p>
    </div>
  );
}

export function PortfolioSummary({
  metrics,
  loading,
  hydrated = true,
}: PortfolioSummaryProps) {
  const showSkeleton = Boolean(loading && !hydrated);
  const dash = (n: number) => (showSkeleton ? null : n);

  const cells: MetricCellProps[] = [
    { label: "Programs", value: dash(metrics.programs), delay: 0 },
    { label: "Running", value: dash(metrics.running), accent: "teal", delay: 40 },
    { label: "Paused", value: dash(metrics.paused), accent: "amber", delay: 80 },
    {
      label: "Act now",
      value: dash(metrics.actNow),
      accent: metrics.actNow > 0 ? "teal" : "default",
      delay: 120,
    },
    {
      label: "Too early",
      value: dash(metrics.tooEarly),
      accent: metrics.tooEarly > 0 ? "signal" : "default",
      delay: 160,
    },
    {
      label: "Avg confidence",
      value: showSkeleton ? null : `${metrics.avgConfidence}%`,
      delay: 200,
    },
  ];

  return (
    <div
      className={cn(
        "dashboard-summary overflow-clip rounded-xl border",
        "grid grid-cols-2 divide-x divide-y sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0"
      )}
      style={{
        borderColor: "rgba(15, 26, 46, 0.1)",
        background: "var(--v3-paper)",
        borderWidth: 0.5,
      }}
    >
      {cells.map((cell) => (
        <MetricCell key={cell.label} {...cell} />
      ))}
    </div>
  );
}
