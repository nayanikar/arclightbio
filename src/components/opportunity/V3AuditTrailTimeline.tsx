"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink } from "lucide-react";
import type { AgentTrailEntry } from "@/types/AgentTrail";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  filterTrailForHypothesis,
  humanizeAgent,
  sourceTypeLabel,
} from "@/lib/trailLabels";
import { useOpportunityStore } from "@/store/opportunityStore";
import { cn } from "@/lib/utils";

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const KIND_COLORS: Record<AgentTrailEntry["kind"], string> = {
  started: "var(--v3-teal)",
  completed: "#2d6a4f",
  failed: "#b42318",
  source: "var(--v3-amber)",
  reasoning: "#7c5cbf",
};

function TrailRow({ entry }: { entry: AgentTrailEntry }) {
  const pipColor = KIND_COLORS[entry.kind] ?? "var(--v3-navy)";

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative pl-5"
    >
      <span
        className="absolute left-0 top-1.5 h-2 w-2 rounded-full ring-2 ring-white"
        style={{ background: pipColor }}
      />
      <div className="pb-4">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span
            className="font-mono text-[10px] tabular-nums"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {formatTime(entry.timestamp)}
          </span>
          <span
            className="text-xs font-medium"
            style={{ color: "var(--v3-navy)" }}
          >
            {entry.title}
          </span>
        </div>
        <p
          className="mt-0.5 text-[10px] uppercase tracking-wide"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          {humanizeAgent(entry.agent)}
          {entry.kind !== "completed" && entry.kind !== "started"
            ? ` · ${entry.kind}`
            : ""}
        </p>

        {entry.summary && (
          <div
            className="mt-2 border-l-2 py-1 pl-3 text-xs leading-relaxed"
            style={{
              borderColor: "rgba(196, 132, 45, 0.5)",
              color: "var(--color-text-secondary)",
            }}
          >
            {entry.summary}
          </div>
        )}

        {entry.sources && entry.sources.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {entry.sources.map((source) => (
              <a
                key={`${entry.id}-${source.url}-${source.label}`}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors hover:opacity-90"
                )}
                style={{
                  borderColor: "rgba(26, 107, 99, 0.25)",
                  background: "rgba(26, 107, 99, 0.06)",
                  color: "var(--v3-teal)",
                }}
              >
                <span className="truncate">{sourceTypeLabel(source.type)}</span>
                <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-70" />
              </a>
            ))}
          </div>
        )}
      </div>
    </motion.li>
  );
}

export function V3AuditTrailTimeline({ hypothesisId }: { hypothesisId?: string }) {
  const { trailEntries, isStreaming } = useOpportunityStore();
  const filtered = useMemo(
    () => filterTrailForHypothesis(trailEntries, hypothesisId),
    [trailEntries, hypothesisId]
  );

  const displayEntries = useMemo(
    () =>
      [...filtered]
        .filter((e) => e.kind !== "started")
        .slice(-80)
        .reverse(),
    [filtered]
  );

  if (!displayEntries.length) {
    return (
      <p className="px-1 py-3 text-xs" style={{ color: "var(--color-text-tertiary)" }}>
        {isStreaming
          ? "Trail will populate as agents run…"
          : "No audit trail entries yet."}
      </p>
    );
  }

  return (
    <div className="relative">
      <ScrollArea className="h-[min(360px,50vh)] pr-2">
        <ul
          className="relative border-l border-dashed pb-4 pl-3"
          style={{ borderColor: "rgba(26, 107, 99, 0.2)" }}
        >
          <AnimatePresence initial={false}>
            {displayEntries.map((entry) => (
              <TrailRow key={entry.id} entry={entry} />
            ))}
          </AnimatePresence>
        </ul>
      </ScrollArea>
    </div>
  );
}
