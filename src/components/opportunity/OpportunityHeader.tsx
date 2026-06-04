"use client";

import type { Hypothesis, OpportunityStatus, DomainContext } from "@/types/OpportunityObject";
import { Badge } from "@/components/ui/badge";
import { domainContextLabel } from "@/lib/domainContext";
import { cn } from "@/lib/utils";

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

interface OpportunityHeaderProps {
  searchQuery?: string;
  hypothesis: Hypothesis;
  status: OpportunityStatus;
  mode?: "speed" | "depth";
  domainContext?: DomainContext;
}

export function OpportunityHeader({
  searchQuery,
  hypothesis,
  status,
  mode,
  domainContext,
}: OpportunityHeaderProps) {
  const title = searchQuery ?? hypothesis.statement;

  return (
    <header className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {mode && (
          <Badge variant="outline" className="capitalize text-xs">
            {mode}
          </Badge>
        )}
        {domainContext && domainContext !== "general" && (
          <Badge
            variant="outline"
            className="border-brand-purple/40 text-xs text-brand-purple"
          >
            {domainContextLabel(domainContext)}
          </Badge>
        )}
        <Badge className={cn(STATUS_STYLES[status], "border-0 text-xs font-medium")}>
          {STATUS_LABELS[status]}
        </Badge>
      </div>
      <h1 className="text-xl font-semibold leading-snug text-gray-900 text-balance">
        {title}
      </h1>
      {searchQuery && searchQuery !== hypothesis.statement && (
        <p className="line-clamp-2 text-sm text-gray-500">{hypothesis.statement}</p>
      )}
    </header>
  );
}
