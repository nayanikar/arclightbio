"use client";

import type { RiskComponents } from "@/types/V3Pipeline";
import { V3Panel } from "@/components/opportunity/v3/V3Panel";

interface RiskOfFailurePanelProps {
  riskScore?: number | null;
  components?: RiskComponents | null;
  className?: string;
}

const RISK_LABELS: Array<{ key: keyof RiskComponents; label: string }> = [
  { key: "target", label: "Target validation" },
  { key: "ip", label: "IP / FTO" },
  { key: "modality_development", label: "Modality development" },
  { key: "market_penetration", label: "Market penetration" },
  { key: "infrastructure", label: "Infrastructure" },
  { key: "competition", label: "Competition" },
  { key: "other", label: "Other" },
];

export function RiskOfFailurePanel({
  riskScore,
  components,
  className,
}: RiskOfFailurePanelProps) {
  const hasData = riskScore != null || components;

  if (!hasData) {
    return (
      <V3Panel title="Risk of failure" description="Composite development risk" className={className}>
        <p className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>
          Risk scoring completes after druggability and modality selection
        </p>
      </V3Panel>
    );
  }

  const overallPct =
    riskScore != null ? Math.round(riskScore * 100) : estimateOverall(components);

  return (
    <V3Panel
      title="Risk of failure"
      description="Weighted composite across development dimensions"
      className={className}
    >
      <div className="flex items-baseline gap-3">
        <span
          className="font-display text-3xl font-semibold tabular-nums"
          style={{ color: overallPct >= 60 ? "var(--v3-amber)" : "var(--v3-teal)" }}
        >
          {overallPct}%
        </span>
        <span className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
          estimated program failure risk
        </span>
      </div>
      {components && (
        <ul className="mt-4 space-y-2">
          {RISK_LABELS.map(({ key, label }) => {
            const value = components[key];
            if (value == null) return null;
            const pct = Math.round(value * 100);
            return (
              <li key={key}>
                <div className="flex justify-between text-xs">
                  <span style={{ color: "var(--color-text-secondary)" }}>{label}</span>
                  <span className="font-mono tabular-nums" style={{ color: "var(--v3-navy)" }}>
                    {pct}%
                  </span>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-[rgba(15,26,46,0.06)]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      background:
                        pct >= 70
                          ? "var(--v3-amber)"
                          : pct >= 40
                            ? "var(--v3-teal-light)"
                            : "var(--v3-teal)",
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </V3Panel>
  );
}

function estimateOverall(components?: RiskComponents | null): number {
  if (!components) return 0;
  const values = RISK_LABELS.map(({ key }) => components[key]).filter(
    (v): v is number => v != null
  );
  if (values.length === 0) return 0;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100);
}
