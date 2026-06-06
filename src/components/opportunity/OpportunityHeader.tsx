"use client";

import type { Hypothesis, OpportunityStatus } from "@/types/OpportunityObject";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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

interface OpportunityHeaderProps {
  searchQuery?: string;
  hypothesis: Hypothesis;
  status: OpportunityStatus;
}

export function OpportunityHeader({
  searchQuery,
  hypothesis,
  status,
}: OpportunityHeaderProps) {
  const title = searchQuery ?? hypothesis.statement;

  return (
    <header className="space-y-3">
      <Badge className={cn(STATUS_STYLES[status], "w-fit border-0 text-xs font-medium")}>
        {STATUS_LABELS[status]}
      </Badge>
      <h1
        className="font-display text-2xl font-semibold leading-snug text-balance"
        style={{ color: "var(--color-text-primary)" }}
      >
        {title}
      </h1>
      {searchQuery && searchQuery !== hypothesis.statement && (
        <p
          className="line-clamp-3 text-sm leading-relaxed"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {hypothesis.statement}
        </p>
      )}
    </header>
  );
}
