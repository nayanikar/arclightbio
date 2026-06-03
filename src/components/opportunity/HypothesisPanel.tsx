"use client";

import { useMemo } from "react";
import type { EvidenceTier, Hypothesis, OpportunityStatus } from "@/types/OpportunityObject";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/layout/Panel";
import { EvidenceTierBadge } from "@/components/opportunity/EvidenceTierBadge";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface HypothesisPanelProps {
  hypothesis: Hypothesis;
  status: OpportunityStatus;
  searchQuery?: string;
  scoreHistory?: Array<{ time: string; score: number }>;
  mode?: "speed" | "depth";
  evidenceTier?: EvidenceTier;
}

const STATUS_STYLES: Record<OpportunityStatus, string> = {
  initialising: "bg-gray-100 text-gray-600",
  agents_running: "bg-brand-purple/10 text-brand-purple animate-pulse",
  complete: "bg-brand-teal/10 text-brand-teal",
  surveillance: "bg-brand-teal/10 text-brand-teal animate-pulse",
  paused: "bg-gray-100 text-gray-600",
  archived: "bg-gray-100 text-gray-600",
};

const STATUS_LABELS: Record<OpportunityStatus, string> = {
  initialising: "Initialising",
  agents_running: "Agents running",
  complete: "Complete",
  surveillance: "Watching",
  paused: "Paused",
  archived: "Archived",
};

function DetailBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-gray-700 line-clamp-4">
        {text}
      </p>
    </div>
  );
}

export function HypothesisPanel({
  hypothesis,
  status,
  searchQuery,
  scoreHistory = [],
  mode,
  evidenceTier,
}: HypothesisPanelProps) {
  const chartData = useMemo(
    () => scoreHistory.map((point, index) => ({ ...point, index })),
    [scoreHistory]
  );

  return (
    <Panel
      title="Named hypothesis"
      description={searchQuery ? `Query: ${searchQuery}` : undefined}
      action={
        <div className="flex items-center gap-2">
          {evidenceTier && <EvidenceTierBadge tier={evidenceTier} />}
          {mode && (
            <Badge variant="outline" className="capitalize text-xs">
              {mode}
            </Badge>
          )}
          <Badge className={cnBadge(STATUS_STYLES[status])}>
            {STATUS_LABELS[status]}
          </Badge>
        </div>
      }
    >
      <p className="text-base font-medium leading-snug text-gray-900 text-balance">
        {hypothesis.statement}
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <DetailBlock label="Patient population" text={hypothesis.patient_population} />
        <DetailBlock label="Unmet need" text={hypothesis.unmet_need} />
        <DetailBlock label="Org positioning" text={hypothesis.org_positioning} />
      </div>

      {chartData.length > 1 && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Evidence velocity
          </p>
          <div className="h-12">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <Tooltip formatter={(v) => `${(Number(v) * 100).toFixed(0)}%`} />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#1D9E75"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </Panel>
  );
}

function cnBadge(classes: string) {
  return `${classes} border-0 text-xs font-medium`;
}
