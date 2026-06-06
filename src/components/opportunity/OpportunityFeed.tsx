"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useParams } from "next/navigation";
import { useOpportunityStore } from "@/store/opportunityStore";
import { EvidenceCardComponent } from "./EvidenceCard";
import { ChallengeCard } from "./ChallengeCard";
import { SurveillancePanel } from "./SurveillancePanel";
import { useSurveillanceScan } from "@/hooks/useSurveillanceScan";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Panel } from "@/components/layout/Panel";
import { Loader2, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

const FEED_SCROLL_HEIGHT = "h-[min(420px,calc(100vh-22rem))]";

export function OpportunityFeed({
  onResume,
  resuming,
}: {
  onResume?: () => void;
  resuming?: boolean;
}) {
  const params = useParams();
  const opportunityId = params.id as string;
  const { streamingCards, isStreaming, status, changeLog, lastSurveillanceCheck, actionabilityZone, opportunity } =
    useOpportunityStore();

  const surveillanceActive =
    status === "surveillance" || status === "complete";
  const showSurveillance =
    status === "surveillance" || status === "complete" || status === "paused";

  const { steps, summary, isScanning, countdown } = useSurveillanceScan(
    opportunityId,
    surveillanceActive,
    status === "paused"
  );

  const sortedCards = [...streamingCards]
    .filter((c) => !c.is_target_list && !c.is_modality_card)
    .sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const statusLabel = isStreaming ? (
    <span className="flex items-center gap-1.5 text-xs font-medium text-brand-purple">
      <Loader2 className="h-3 w-3 animate-spin" />
      Agents posting…
    </span>
  ) : status === "surveillance" ? (
    <span className="flex items-center gap-1.5 text-xs font-medium text-brand-teal">
      <Radio className="h-3 w-3" />
      Watching
    </span>
  ) : status === "paused" ? (
    <span className="text-xs font-medium text-gray-500">
      {opportunity?.decision_brief ? "Complete · surveillance paused" : "Paused mid-run"}
    </span>
  ) : status === "complete" ? (
    <span className="text-xs font-medium text-brand-teal">Complete</span>
  ) : null;

  return (
    <div
      className={cn(
        "grid gap-4",
        showSurveillance ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
      )}
    >
      <Panel
        title="Evidence stream"
        description={`${sortedCards.filter((c) => !c.is_challenge).length} cards · ${sortedCards.filter((c) => c.is_challenge).length} challenges`}
        action={statusLabel}
        noPadding
        bodyClassName="p-0"
      >
        <ScrollArea className={FEED_SCROLL_HEIGHT}>
          <div className="space-y-2 p-4">
            {sortedCards.length === 0 ? (
              <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/50 text-sm text-gray-400">
                {isStreaming
                  ? "Waiting for agents to post evidence…"
                  : "No evidence cards yet."}
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {sortedCards.map((card) => {
                  const isSurveillanceCard = Boolean(
                    card.raw_source_metadata?.surveillance
                  );

                  return (
                    <motion.div
                      key={card.id}
                      id={card.is_challenge ? undefined : `card-${card.id}`}
                      initial={
                        isSurveillanceCard
                          ? { opacity: 0, y: -12, scale: 0.98 }
                          : { opacity: 0, y: -8 }
                      }
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={
                        isSurveillanceCard
                          ? { duration: 0.35, ease: "easeOut" }
                          : { duration: 0.2 }
                      }
                    >
                      {card.is_challenge ? (
                        <ChallengeCard
                          content={card.content}
                          scoreImpact={card.challenge_metadata?.score_impact}
                          deriskRecommendation={card.derisk_recommendation}
                        />
                      ) : (
                        <EvidenceCardComponent
                          content={card.content}
                          sourceUrl={card.source_url}
                          agent={card.contributing_agent}
                          timestamp={card.timestamp}
                          qualityScore={card.quality_scores.composite}
                          partial={Boolean(card.raw_source_metadata?.partial)}
                          isNew={isSurveillanceCard}
                          isCrossDomain={card.is_cross_domain}
                          isNoveltyCheck={card.is_novelty_check}
                          noveltyVerdict={
                            (
                              card.raw_source_metadata?.novelty_verdicts as
                                | Array<{ verdict?: string }>
                                | undefined
                            )?.[0]?.verdict
                          }
                        />
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </ScrollArea>
      </Panel>

      {showSurveillance && (
        <SurveillancePanel
          status={status}
          actionabilityZone={actionabilityZone}
          lastCheckedAt={lastSurveillanceCheck}
          steps={steps}
          summary={summary}
          isScanning={isScanning}
          countdown={countdown}
          changeLog={changeLog}
          scrollClassName={FEED_SCROLL_HEIGHT}
          onResume={onResume}
          resuming={resuming}
        />
      )}
    </div>
  );
}
