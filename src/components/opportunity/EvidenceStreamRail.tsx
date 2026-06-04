"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useOpportunityStore } from "@/store/opportunityStore";
import { AGENT_PIP_COLORS } from "@/lib/dashboardLayout";
import type { AgentName, EvidenceCard } from "@/types/OpportunityObject";
import { ChallengeCard } from "./ChallengeCard";
import { EvidenceCardComponent } from "./EvidenceCard";
import { Loader2, Radio, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

const AGENT_LABELS: Record<AgentName, string> = {
  literature: "Literature",
  mechanism: "Mechanism",
  clinical_trial: "Clinical Trial",
  commercial: "Commercial",
  regulatory: "Regulatory",
  rwe_signal: "RWE",
  modality: "Modality",
};

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function CompactEvidenceRow({
  card,
  expanded,
  onToggle,
}: {
  card: EvidenceCard;
  expanded: boolean;
  onToggle: () => void;
}) {
  const agent = card.contributing_agent;
  const color = AGENT_PIP_COLORS[agent];

  return (
    <div className="border-b border-white/5 last:border-0">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-white/5",
          expanded && "bg-white/5"
        )}
      >
        <span
          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[11px] leading-snug text-white/70">
            {card.content}
          </p>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="text-[10px] text-white/35">{AGENT_LABELS[agent]}</span>
            {card.is_cross_domain && (
              <span className="h-1 w-1 rounded-full bg-brand-purple/80" title="Cross-domain" />
            )}
            {card.is_novelty_check && (
              <span className="h-1 w-1 rounded-full bg-brand-teal/80" title="Novelty" />
            )}
            <span className="text-[10px] text-white/25">{formatTime(card.timestamp)}</span>
          </div>
        </div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden px-3 pb-3"
          >
            <div className="rounded-md border border-white/10 bg-white/[0.03] p-2">
              <EvidenceCardComponent
                content={card.content}
                sourceUrl={card.source_url}
                agent={card.contributing_agent}
                timestamp={card.timestamp}
                qualityScore={card.quality_scores.composite}
                partial={Boolean(card.raw_source_metadata?.partial)}
                isCrossDomain={card.is_cross_domain}
                isNoveltyCheck={card.is_novelty_check}
                noveltyVerdict={
                  (
                    card.raw_source_metadata?.novelty_verdicts as
                      | Array<{ verdict?: string }>
                      | undefined
                  )?.[0]?.verdict
                }
                className="border-0 bg-transparent p-0 hover:bg-transparent [&_p]:text-white/80 [&_.text-gray-400]:text-white/40 [&_.text-gray-800]:text-white/80"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function EvidenceStreamRail({ className }: { className?: string }) {
  const { streamingCards, isStreaming, status, selectedAgent, setSelectedAgent } =
    useOpportunityStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sortedCards = [...streamingCards]
    .filter((c) => !c.is_target_list && !c.is_modality_card)
    .filter((c) => !selectedAgent || c.contributing_agent === selectedAgent)
    .sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

  const evidenceCount = sortedCards.filter((c) => !c.is_challenge).length;
  const challengeCount = sortedCards.filter((c) => c.is_challenge).length;

  const statusLabel = isStreaming ? (
    <span className="flex items-center gap-1 text-[10px] text-brand-purple">
      <Loader2 className="h-2.5 w-2.5 animate-spin" />
      Live
    </span>
  ) : status === "surveillance" ? (
    <span className="flex items-center gap-1 text-[10px] text-white/50">
      <Radio className="h-2.5 w-2.5" />
      Watching
    </span>
  ) : null;

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50">
            Evidence
          </p>
          <p className="text-[10px] text-white/30">
            {evidenceCount} cards · {challengeCount} challenges
          </p>
        </div>
        <div className="flex items-center gap-2">
          {statusLabel}
          {selectedAgent && (
            <button
              type="button"
              onClick={() => setSelectedAgent(null)}
              className="inline-flex items-center gap-0.5 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60 hover:bg-white/15"
            >
              {AGENT_LABELS[selectedAgent]}
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="py-1">
          {sortedCards.length === 0 ? (
            <p className="px-3 py-8 text-center text-[11px] text-white/30">
              {isStreaming
                ? "Waiting for agents…"
                : selectedAgent
                  ? "No cards from this agent."
                  : "No evidence yet."}
            </p>
          ) : (
            sortedCards.map((card) =>
              card.is_challenge ? (
                <div key={card.id} className="border-b border-white/5 px-3 py-2 last:border-0">
                  <ChallengeCard
                    content={card.content}
                    scoreImpact={card.challenge_metadata?.score_impact}
                    deriskRecommendation={card.derisk_recommendation}
                  />
                </div>
              ) : (
                <CompactEvidenceRow
                  key={card.id}
                  card={card}
                  expanded={expandedId === card.id}
                  onToggle={() =>
                    setExpandedId((id) => (id === card.id ? null : card.id))
                  }
                />
              )
            )
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
