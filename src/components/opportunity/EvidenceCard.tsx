"use client";

import type { AgentName } from "@/types/OpportunityObject";
import { cn } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

const AGENT_COLORS: Record<AgentName, string> = {
  literature: "bg-agent-literature",
  mechanism: "bg-agent-mechanism",
  clinical_trial: "bg-agent-clinical",
  commercial: "bg-agent-commercial",
  regulatory: "bg-agent-regulatory",
  rwe_signal: "bg-agent-rwe",
};

const AGENT_LABELS: Record<AgentName, string> = {
  literature: "Literature",
  mechanism: "Mechanism",
  clinical_trial: "Clinical Trial",
  commercial: "Commercial",
  regulatory: "Regulatory",
  rwe_signal: "RWE Signal",
};

interface EvidenceCardProps {
  content: string;
  sourceUrl?: string;
  agent: AgentName;
  timestamp?: string;
  qualityScore?: number;
  partial?: boolean;
  isNew?: boolean;
  className?: string;
}

export function EvidenceCardComponent({
  content,
  sourceUrl,
  agent,
  timestamp,
  qualityScore,
  partial,
  isNew,
  className,
}: EvidenceCardProps) {
  return (
    <article
      className={cn(
        "rounded-lg border bg-gray-50/80 p-4 transition-colors hover:bg-gray-50",
        isNew
          ? "border-brand-teal/40 bg-brand-teal/[0.03] shadow-sm shadow-brand-teal/10"
          : "border-gray-100",
        className
      )}
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold text-white",
              AGENT_COLORS[agent]
            )}
          >
            {AGENT_LABELS[agent]}
          </span>
          {isNew && (
            <span className="rounded-md bg-brand-teal/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-teal">
              New
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-gray-400">
          {partial && (
            <span className="rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-700">
              Partial
            </span>
          )}
          {qualityScore !== undefined && (
            <span>{(qualityScore * 100).toFixed(0)}% quality</span>
          )}
        </div>
      </div>
      <p className="text-sm leading-relaxed text-gray-800">{content}</p>
      <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2">
        {sourceUrl ? (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-purple hover:underline"
          >
            View source
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <span />
        )}
        {timestamp && (
          <time className="text-[11px] text-gray-400">
            {new Date(timestamp).toLocaleTimeString()}
          </time>
        )}
      </div>
    </article>
  );
}
