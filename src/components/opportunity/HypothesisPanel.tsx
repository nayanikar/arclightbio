"use client";

import type { EvidenceTier, Hypothesis, OpportunityStatus } from "@/types/OpportunityObject";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/layout/Panel";
import { EvidenceTierBadge } from "@/components/opportunity/EvidenceTierBadge";

interface HypothesisPanelProps {
  hypothesis: Hypothesis;
  status: OpportunityStatus;
  evidenceTier?: EvidenceTier;
}

const STATUS_STYLES: Record<OpportunityStatus, string> = {
  initialising: "bg-gray-100 text-gray-600",
  agents_running: "bg-brand-purple/10 text-brand-purple animate-pulse",
  agents_failed: "bg-red-100 text-red-700",
  complete: "bg-brand-teal/10 text-brand-teal",
  surveillance: "bg-brand-teal/10 text-brand-teal animate-pulse",
  paused: "bg-gray-100 text-gray-600",
  archived: "bg-gray-100 text-gray-600",
};

const STATUS_LABELS: Record<OpportunityStatus, string> = {
  initialising: "Initialising",
  agents_running: "Agents running",
  agents_failed: "Discovery failed",
  complete: "Complete",
  surveillance: "Watching",
  paused: "Paused",
  archived: "Archived",
};

function DetailBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-lg border border-[#EDE8E0] bg-gray-50/60 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-gray-700">{text}</p>
    </div>
  );
}

export function HypothesisPanel({
  hypothesis,
  status,
  evidenceTier,
}: HypothesisPanelProps) {
  return (
    <Panel
      title="Named hypothesis"
      action={
        <div className="flex items-center gap-2">
          {hypothesis.source === "fallback" && (
            <Badge className="border-0 bg-amber-50 text-xs font-medium text-amber-700">
              Unverified placeholder
            </Badge>
          )}
          {evidenceTier && <EvidenceTierBadge tier={evidenceTier} />}
          <Badge className={`${STATUS_STYLES[status]} border-0 text-xs font-medium`}>
            {STATUS_LABELS[status]}
          </Badge>
        </div>
      }
      bodyClassName="pt-3"
    >
      <p className="text-base font-medium leading-relaxed text-gray-900 text-balance">
        {hypothesis.statement}
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <DetailBlock label="Patient population" text={hypothesis.patient_population} />
        <DetailBlock label="Unmet need" text={hypothesis.unmet_need} />
        <DetailBlock label="Org positioning" text={hypothesis.org_positioning} />
      </div>
    </Panel>
  );
}
