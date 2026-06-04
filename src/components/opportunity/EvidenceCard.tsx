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
  modality: "bg-agent-modality",
};

const AGENT_LABELS: Record<AgentName, string> = {
  literature: "Literature",
  mechanism: "Mechanism",
  clinical_trial: "Clinical Trial",
  commercial: "Commercial",
  regulatory: "Regulatory",
  rwe_signal: "RWE Signal",
  modality: "Modality",
};

interface EvidenceCardProps {
  content: string;
  sourceUrl?: string;
  agent: AgentName;
  timestamp?: string;
  qualityScore?: number;
  partial?: boolean;
  isNew?: boolean;
  isCrossDomain?: boolean;
  isNoveltyCheck?: boolean;
  noveltyVerdict?: string;
  className?: string;
  variant?: "default" | "compact";
}

function formatCompactTime(ts?: string): string {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function EvidenceCardCompact({
  content,
  agent,
  timestamp,
  isCrossDomain,
  isNoveltyCheck,
  className,
}: Pick<
  EvidenceCardProps,
  "content" | "agent" | "timestamp" | "isCrossDomain" | "isNoveltyCheck" | "className"
>) {
  const pipColor: Record<AgentName, string> = {
    literature: "#534AB7",
    mechanism: "#1D9E75",
    clinical_trial: "#378ADD",
    commercial: "#BA7517",
    regulatory: "#D85A30",
    rwe_signal: "#639922",
    modality: "#8B5CF6",
  };

  return (
    <div className={cn("flex items-start gap-2", className)}>
      <span
        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: pipColor[agent] }}
      />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[11px] leading-snug text-white/70">{content}</p>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="text-[10px] text-white/35">{AGENT_LABELS[agent]}</span>
          {isCrossDomain && (
            <span className="h-1 w-1 rounded-full bg-brand-purple/80" title="Cross-domain" />
          )}
          {isNoveltyCheck && (
            <span className="h-1 w-1 rounded-full bg-brand-teal/80" title="Novelty" />
          )}
          {timestamp && (
            <span className="text-[10px] text-white/25">{formatCompactTime(timestamp)}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function noveltyBadgeClass(verdict?: string): string {
  if (!verdict) return "bg-brand-teal/15 text-brand-teal";
  const v = verdict.toLowerCase();
  if (v === "confirmed" || v === "likely") return "bg-brand-teal/15 text-brand-teal";
  if (v === "uncertain") return "bg-amber-50 text-amber-700";
  return "bg-red-50 text-brand-coral";
}

export function EvidenceCardComponent({
  content,
  sourceUrl,
  agent,
  timestamp,
  qualityScore,
  partial,
  isNew,
  isCrossDomain,
  isNoveltyCheck,
  noveltyVerdict,
  className,
}: EvidenceCardProps) {
  const verdictLabel = isNoveltyCheck
    ? content.match(/First-in-class (\w+)/i)?.[1] ??
      noveltyVerdict ??
      "Novelty check"
    : undefined;

  return (
    <article
      className={cn(
        "rounded-lg border bg-gray-50/80 p-4 transition-colors hover:bg-gray-50",
        isCrossDomain && "border-l-4 border-l-brand-purple",
        isNew
          ? "border-brand-teal/40 bg-brand-teal/[0.03] shadow-sm shadow-brand-teal/10"
          : !isCrossDomain && "border-gray-100",
        className
      )}
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold text-white",
              AGENT_COLORS[agent]
            )}
          >
            {AGENT_LABELS[agent]}
          </span>
          {isCrossDomain && (
            <span className="rounded-md bg-brand-purple/15 px-1.5 py-0.5 text-[10px] font-semibold text-brand-purple">
              Cross-domain signal
            </span>
          )}
          {isNoveltyCheck && verdictLabel && (
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                noveltyBadgeClass(verdictLabel)
              )}
            >
              First-in-class: {verdictLabel}
            </span>
          )}
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
