"use client";

import type { DashboardMetrics } from "@/lib/dashboardLayout";

interface MetricCardsProps {
  metrics: DashboardMetrics;
  loading?: boolean;
}

export function MetricCards({ metrics, loading }: MetricCardsProps) {
  const cards = [
    {
      label: "Active",
      value: loading && metrics.active === 0 ? "—" : metrics.active,
      color: "var(--color-text-primary)",
    },
    {
      label: "Act now",
      value: loading && metrics.actNow === 0 ? "—" : metrics.actNow,
      color: "#1D9E75",
    },
    {
      label: "Too early",
      value: loading && metrics.tooEarly === 0 ? "—" : metrics.tooEarly,
      color: "#D85A30",
    },
    {
      label: "Avg confidence",
      value:
        loading && metrics.avgConfidence === 0
          ? "—"
          : `${metrics.avgConfidence}%`,
      color: "var(--color-text-primary)",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-[10px] lg:grid-cols-4">
      {cards.map(({ label, value, color }) => (
        <div
          key={label}
          className="rounded-lg p-3"
          style={{ background: "var(--color-background-secondary)" }}
        >
          <p
            className="mb-1.5 text-[11px]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {label}
          </p>
          <p
            className="text-[26px] font-medium tabular-nums"
            style={{ color }}
          >
            {value}
          </p>
        </div>
      ))}
    </div>
  );
}
