"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";
import { useOpportunityStore } from "@/store/opportunityStore";
import {
  filterTrailForHypothesis,
  humanizeAgent,
  humanizeStep,
} from "@/lib/trailLabels";

export function V3LiveAgentActivity({ hypothesisId }: { hypothesisId?: string }) {
  const { status, lastAgentStatus, currentTrailActivity, trailEntries } =
    useOpportunityStore();

  const filtered = useMemo(
    () => filterTrailForHypothesis(trailEntries, hypothesisId),
    [trailEntries, hypothesisId]
  );

  const lastCompleted = useMemo(() => {
    const completed = filtered.filter((e) => e.kind === "completed");
    return completed[completed.length - 1] ?? null;
  }, [filtered]);

  const isRunning = status === "agents_running";
  const active = currentTrailActivity;

  const title = active
    ? active.title
    : lastAgentStatus?.type === "agent_started"
      ? humanizeAgent(lastAgentStatus.agent)
      : lastCompleted
        ? lastCompleted.title
        : "Pipeline idle";

  const subtitle = active
    ? humanizeStep(active.step)
    : lastCompleted
      ? humanizeAgent(lastCompleted.agent)
      : isRunning
        ? "Pipeline running"
        : "Waiting for agent activity";

  const detail =
    active?.summary ??
    (lastAgentStatus?.type === "agent_started"
      ? `Running ${humanizeAgent(lastAgentStatus.agent)}`
      : lastCompleted?.summary);

  return (
    <div
      className="rounded-xl border px-4 py-3"
      style={{
        borderColor: isRunning
          ? "rgba(26, 107, 99, 0.35)"
          : "rgba(15, 26, 46, 0.12)",
        background: isRunning ? "rgba(26, 107, 99, 0.06)" : "var(--v3-paper)",
      }}
    >
      <div className="flex items-start gap-3">
        <span className="relative mt-1 flex h-2.5 w-2.5 shrink-0">
          {isRunning && (
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
              style={{ background: "var(--v3-teal)" }}
            />
          )}
          <span
            className="relative inline-flex h-2.5 w-2.5 rounded-full"
            style={{
              background: isRunning ? "var(--v3-teal)" : "rgba(15, 26, 46, 0.2)",
            }}
          />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="font-mono text-[10px] uppercase tracking-widest"
            style={{ color: isRunning ? "var(--v3-teal)" : "var(--color-text-tertiary)" }}
          >
            {isRunning ? "Live" : "Agent activity"}
          </p>
          <AnimatePresence mode="wait">
            <motion.div
              key={`${title}-${subtitle}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
            >
              <p
                className="mt-1 text-sm font-semibold leading-snug"
                style={{ color: "var(--v3-navy)" }}
              >
                {title}
              </p>
              <p
                className="mt-0.5 font-mono text-[10px] uppercase tracking-wide"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                {subtitle}
              </p>
              {detail && (
                <p
                  className="mt-2 text-xs leading-relaxed line-clamp-3"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {detail}
                </p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
