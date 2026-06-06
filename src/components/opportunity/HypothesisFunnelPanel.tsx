"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { HypothesisRecord } from "@/types/OpportunityObject";
import type { HypothesisStage } from "@/types/V3Pipeline";
import { V3Panel } from "@/components/opportunity/v3/V3Panel";
import { cn } from "@/lib/utils";

interface FunnelStage {
  key: HypothesisStage | "all";
  label: string;
  targetCount: number;
  items: Array<{ id: string; summary: string }>;
}

function buildFunnelStages(hypotheses: HypothesisRecord[]): FunnelStage[] {
  const nonOutgroup = hypotheses.filter((h) => !h.is_outgroup);

  const byStage = (stage: HypothesisStage) =>
    nonOutgroup.filter((h) => h.hypothesis_stage === stage);

  const association = byStage("association");
  const causation = byStage("causation");
  const selectivity = byStage("selectivity");

  const associationItems =
    association.length > 0
      ? association
      : nonOutgroup.slice(0, Math.min(50, nonOutgroup.length));
  const causationItems =
    causation.length > 0
      ? causation
      : nonOutgroup.slice(0, Math.min(20, nonOutgroup.length));
  const selectivityItems =
    selectivity.length > 0
      ? selectivity.slice(0, 3)
      : nonOutgroup
          .filter((h) => h.rank != null && h.rank <= 3)
          .slice(0, 3);

  return [
    {
      key: "association",
      label: "Association filter",
      targetCount: 50,
      items: associationItems.map((h) => ({
        id: h.id,
        summary: h.statement,
      })),
    },
    {
      key: "causation",
      label: "Causation filter",
      targetCount: 20,
      items: causationItems.map((h) => ({
        id: h.id,
        summary: h.statement,
      })),
    },
    {
      key: "selectivity",
      label: "Selectivity rank",
      targetCount: 3,
      items: selectivityItems.map((h) => ({
        id: h.id,
        summary: h.statement,
      })),
    },
  ];
}

function FunnelBar({
  count,
  target,
  label,
  expanded,
  onToggle,
  items,
}: {
  count: number;
  target: number;
  label: string;
  expanded: boolean;
  onToggle: () => void;
  items: Array<{ id: string; summary: string }>;
}) {
  const pct = Math.min(100, (count / target) * 100);

  return (
    <div className="rounded-lg border border-[rgba(15,26,46,0.08)] bg-white/60">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0" style={{ color: "var(--v3-teal)" }} />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "var(--v3-teal)" }} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-medium" style={{ color: "var(--v3-navy)" }}>
              {label}
            </span>
            <span
              className="font-mono text-xs tabular-nums"
              style={{ color: "var(--v3-amber)" }}
            >
              {count} → {target}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[rgba(15,26,46,0.06)]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                background: `linear-gradient(90deg, var(--v3-teal), var(--v3-amber))`,
              }}
            />
          </div>
        </div>
      </button>
      {expanded && items.length > 0 && (
        <ul className="border-t border-[rgba(15,26,46,0.06)] px-4 py-3 space-y-2">
          {items.slice(0, 8).map((item) => (
            <li
              key={item.id}
              className="text-xs leading-relaxed"
              style={{ color: "var(--color-text-secondary)" }}
            >
              <span className="mr-2 font-mono text-[10px]" style={{ color: "var(--v3-teal)" }}>
                ·
              </span>
              {item.summary}
            </li>
          ))}
          {items.length > 8 && (
            <li className="text-[10px]" style={{ color: "var(--color-text-tertiary)" }}>
              +{items.length - 8} more retained hypotheses
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

interface HypothesisFunnelPanelProps {
  hypotheses: HypothesisRecord[];
  className?: string;
}

export function HypothesisFunnelPanel({
  hypotheses,
  className,
}: HypothesisFunnelPanelProps) {
  const stages = buildFunnelStages(hypotheses);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    selectivity: true,
  });

  return (
    <V3Panel
      title="Hypothesis funnel"
      description="50 → 20 → 3 progressive selectivity filter"
      className={className}
      accent
    >
      <div className="space-y-3">
        {stages.map((stage) => (
          <FunnelBar
            key={stage.key}
            count={stage.items.length}
            target={stage.targetCount}
            label={stage.label}
            items={stage.items}
            expanded={expanded[stage.key] ?? false}
            onToggle={() =>
              setExpanded((prev) => ({
                ...prev,
                [stage.key]: !prev[stage.key],
              }))
            }
          />
        ))}
        {hypotheses.length === 0 && (
          <p
            className={cn("rounded-lg px-4 py-6 text-center text-sm")}
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Funnel populates as association → causation → selectivity agents run
          </p>
        )}
      </div>
    </V3Panel>
  );
}
