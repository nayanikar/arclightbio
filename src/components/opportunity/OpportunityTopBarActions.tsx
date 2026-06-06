"use client";

import Link from "next/link";
import { OctagonPause } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SurveillancePauseButton } from "@/components/opportunity/SurveillancePanel";
import { domainContextLabel } from "@/lib/domainContext";
import type { ActionabilityZone, DomainContext, OpportunityStatus } from "@/types/OpportunityObject";

interface OpportunityTopBarActionsProps {
  id: string;
  status: OpportunityStatus;
  mode?: "speed" | "depth";
  domainContext?: DomainContext;
  hypothesisCount?: number;
  actionabilityZone: ActionabilityZone;
  pausing: boolean;
  resuming: boolean;
  onPause: () => void;
  onResume: () => void;
}

export function OpportunityTopBarActions({
  id,
  status,
  mode,
  domainContext,
  hypothesisCount,
  actionabilityZone,
  pausing,
  resuming,
  onPause,
  onResume,
}: OpportunityTopBarActionsProps) {
  const canStopAgents = status === "agents_running";

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <div className="flex flex-wrap items-center gap-1.5">
        {hypothesisCount != null && (
          <Badge
            variant="outline"
            className="max-w-[140px] truncate border-brand-purple/30 text-xs text-brand-purple"
            title={`v2 · ${hypothesisCount} hypotheses`}
          >
            v2 · {hypothesisCount} hyps
          </Badge>
        )}
        {mode && (
          <Badge variant="outline" className="shrink-0 capitalize text-xs">
            {mode}
          </Badge>
        )}
        {domainContext && domainContext !== "general" && (
          <Badge
            variant="outline"
            className="max-w-[160px] truncate border-brand-purple/30 text-xs text-brand-purple"
            title={domainContextLabel(domainContext)}
          >
            {domainContextLabel(domainContext)}
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SurveillancePauseButton
          status={status}
          pausing={pausing}
          resuming={resuming}
          onPause={onPause}
          onResume={onResume}
        />
        {canStopAgents && (
          <Button
            size="sm"
            variant="destructive"
            className="h-8 shrink-0 bg-brand-coral hover:bg-brand-coral/90"
            onClick={onPause}
            disabled={pausing}
          >
            <OctagonPause className="mr-1.5 h-3.5 w-3.5" />
            {pausing ? "Stopping…" : "Stop agents"}
          </Button>
        )}
        {actionabilityZone === "act_now" && (
          <Link href={`/opportunity/${id}/regulatory`} className="shrink-0">
            <Button size="sm" className="h-8 bg-brand-teal hover:bg-brand-teal/90">
              Regulatory package
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
