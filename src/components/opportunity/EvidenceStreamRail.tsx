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

type TrailVariant = "sidebar" | "main";

function CompactEvidenceRow({
  card,
  expanded,
  onToggle,
  variant,
}: {
  card: EvidenceCard;
  expanded: boolean;
  onToggle: () => void;
  variant: TrailVariant;
}) {
  const agent = card.contributing_agent;
  const color = AGENT_PIP_COLORS[agent];
  const isMain = variant === "main";

  return (
    <div
      className={cn(
        "border-b last:border-0",
        isMain ? "border-[#EDE8E0]" : "border-white/5"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex w-full items-start gap-3 px-5 py-3 text-left transition-colors",
          isMain ? "hover:bg-gray-50/80" : "px-3 py-2 hover:bg-white/5",
          expanded && (isMain ? "bg-gray-50/60" : "bg-white/5")
        )}
      >
        <span
          className={cn("shrink-0 rounded-full", isMain ? "mt-2 h-2 w-2" : "mt-1.5 h-1.5 w-1.5")}
          style={{ backgroundColor: color }}
        />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "leading-snug",
              isMain
                ? "text-sm text-gray-800 line-clamp-3"
                : "line-clamp-2 text-[11px] text-white/70"
            )}
          >
            {card.content}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "font-medium",
                isMain ? "text-xs text-gray-500" : "text-[10px] text-white/35"
              )}
            >
              {AGENT_LABELS[agent]}
            </span>
            {card.is_cross_domain && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                  isMain
                    ? "bg-brand-purple/10 text-brand-purple"
                    : "h-1 w-1 rounded-full bg-brand-purple/80"
                )}
                title="Cross-domain"
              >
                {isMain ? "Cross-domain" : ""}
              </span>
            )}
            {card.is_novelty_check && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                  isMain
                    ? "bg-brand-teal/10 text-brand-teal"
                    : "h-1 w-1 rounded-full bg-brand-teal/80"
                )}
                title="Novelty"
              >
                {isMain ? "Novelty" : ""}
              </span>
            )}
            <span className={cn(isMain ? "text-xs text-gray-400" : "text-[10px] text-white/25")}>
              {formatTime(card.timestamp)}
            </span>
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
            className={cn("overflow-hidden", isMain ? "px-5 pb-4" : "px-3 pb-3")}
          >
            <div
              className={cn(
                "rounded-lg border p-3",
                isMain ? "border-[#EDE8E0] bg-gray-50/50" : "border-white/10 bg-white/[0.03] p-2"
              )}
            >
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
                className={
                  isMain
                    ? "border-0 bg-transparent p-0 hover:bg-transparent"
                    : "border-0 bg-transparent p-0 hover:bg-transparent [&_p]:text-white/80 [&_.text-gray-400]:text-white/40 [&_.text-gray-800]:text-white/80"
                }
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function EvidenceStreamRail({
  className,
  variant = "sidebar",
  embedded = false,
}: {
  className?: string;
  variant?: TrailVariant;
  embedded?: boolean;
}) {
  const { streamingCards, isStreaming, status, selectedAgent, setSelectedAgent } =
    useOpportunityStore();
  const isMain = variant === "main";
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sortedCards = [...streamingCards]
    .filter((c) => !c.is_target_list && !c.is_modality_card)
    .filter((c) => isMain || !selectedAgent || c.contributing_agent === selectedAgent)
    .sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

  const evidenceCount = sortedCards.filter((c) => !c.is_challenge).length;
  const challengeCount = sortedCards.filter((c) => c.is_challenge).length;

  const statusLabel = isStreaming ? (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        isMain ? "bg-brand-purple/10 text-brand-purple" : "text-[10px] text-brand-purple"
      )}
    >
      <Loader2 className={cn("animate-spin", isMain ? "h-3 w-3" : "h-2.5 w-2.5")} />
      Live
    </span>
  ) : status === "surveillance" ? (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        isMain ? "bg-brand-teal/10 text-brand-teal" : "text-[10px] text-white/50"
      )}
    >
      <Radio className={cn(isMain ? "h-3 w-3" : "h-2.5 w-2.5")} />
      Watching
    </span>
  ) : null;

  const cardList = (
    <div className={cn(isMain ? "" : "py-1")}>
      {sortedCards.length === 0 ? (
        <p
          className={cn(
            "py-10 text-center",
            isMain ? "px-5 text-sm text-gray-400" : "px-3 text-[11px] text-white/30"
          )}
        >
          {isStreaming
            ? "Waiting for agents…"
            : selectedAgent && !isMain
              ? "No cards from this agent."
              : "No evidence yet."}
        </p>
      ) : (
        sortedCards.map((card) =>
          card.is_challenge ? (
            <div
              key={card.id}
              className={cn(
                "border-b last:border-0",
                isMain ? "border-[#EDE8E0] px-5 py-3" : "border-white/5 px-3 py-2"
              )}
            >
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
              variant={variant}
              expanded={expandedId === card.id}
              onToggle={() =>
                setExpandedId((id) => (id === card.id ? null : card.id))
              }
            />
          )
        )
      )}
    </div>
  );

  if (embedded) {
    return (
      <div className={className}>
        <div
          className={cn(
            "flex items-center justify-between border-b px-5 py-2.5",
            isMain ? "border-[#EDE8E0] bg-gray-50/40" : "border-white/10"
          )}
        >
          <p className={cn(isMain ? "text-xs text-gray-500" : "text-[10px] text-white/30")}>
            {evidenceCount} cards · {challengeCount} challenges
          </p>
          {statusLabel}
        </div>
        {cardList}
      </div>
    );
  }

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

      <ScrollArea className="flex-1">{cardList}</ScrollArea>
    </div>
  );
}
