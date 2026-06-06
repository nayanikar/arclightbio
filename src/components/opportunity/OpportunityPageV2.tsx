"use client";

import { useEffect, useMemo, useState } from "react";
import { OpportunityTopBarActions } from "@/components/opportunity/OpportunityTopBarActions";
import { PageContent } from "@/components/layout/PageContent";
import { OpportunityHeader } from "@/components/opportunity/OpportunityHeader";
import { HypothesisRankList } from "@/components/opportunity/HypothesisRankList";
import { HypothesisDetailPanel } from "@/components/opportunity/HypothesisDetailPanel";
import { OutgroupCalibrationBanner } from "@/components/opportunity/OutgroupCalibrationBanner";
import { PrioritizedTargetsPanel } from "@/components/opportunity/PrioritizedTargetsPanel";
import { DecisionBriefPanel } from "@/components/opportunity/DecisionBriefPanel";
import { MechanisticChainPanel } from "@/components/opportunity/MechanisticChainPanel";
import { SessionSummaryPanel } from "@/components/opportunity/SessionSummaryPanel";
import { ModalityPanel } from "@/components/opportunity/ModalityPanel";
import { ScoreStrip } from "@/components/opportunity/ScoreStrip";
import { OpportunityTrailsPanel } from "@/components/opportunity/OpportunityTrailsPanel";
import { useOpportunityStore } from "@/store/opportunityStore";
import { useSurveillanceSessionControls } from "@/hooks/useSurveillanceSessionControls";
import type { OpportunityObject } from "@/types/OpportunityObject";
import { TopBar } from "@/components/layout/TopBar";
import { cardVisibleForHypothesis } from "@/lib/hypothesisCards";

interface OpportunityPageV2Props {
  obj: OpportunityObject;
  id: string;
  reconnect: () => void;
}

export function OpportunityPageV2({ obj: initialObj, id, reconnect }: OpportunityPageV2Props) {
  const { opportunity, status, streamingCards, blackboardError, lastAgentStatus } =
    useOpportunityStore();
  const liveObj = opportunity ?? initialObj;
  const {
    pausing,
    resuming,
    pauseError,
    resumeError,
    handlePause,
    handleResume,
  } = useSurveillanceSessionControls();

  const hypotheses = liveObj.hypotheses ?? [];
  const defaultSelected =
    liveObj.top_hypothesis_id ??
    hypotheses.find((h) => !h.is_outgroup)?.id ??
    hypotheses[0]?.id;
  const [selectedId, setSelectedId] = useState<string | undefined>(defaultSelected);

  useEffect(() => {
    if (liveObj.top_hypothesis_id) {
      setSelectedId(liveObj.top_hypothesis_id);
    }
  }, [liveObj.top_hypothesis_id]);

  const selected = hypotheses.find((h) => h.id === selectedId) ?? hypotheses[0];
  const filteredCards = useMemo(
    () => streamingCards.filter((c) => cardVisibleForHypothesis(c, selectedId)),
    [streamingCards, selectedId]
  );

  const displayConfidence =
    selected?.confidence_score ?? liveObj.confidence_score;
  const displayZone =
    selected?.actionability_zone ?? liveObj.actionability_zone;

  return (
    <>
      <TopBar
        title="Discovery program"
        subtitle={liveObj.search_query ?? "Multi-hypothesis evaluation"}
        badge={
          <OpportunityTopBarActions
            id={id}
            status={status}
            mode={liveObj.mode}
            domainContext={liveObj.domain_context}
            hypothesisCount={hypotheses.length}
            actionabilityZone={displayZone}
            pausing={pausing}
            resuming={resuming}
            onPause={handlePause}
            onResume={handleResume}
          />
        }
      />

      <PageContent>
        {(blackboardError || pauseError || resumeError) && (
          <div className="mb-4 space-y-2">
            {blackboardError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <p className="font-medium">Discovery pipeline failed</p>
                <p className="mt-1 text-xs text-red-700">{blackboardError}</p>
              </div>
            )}
            {pauseError && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
                {pauseError}
              </div>
            )}
            {resumeError && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
                {resumeError}
              </div>
            )}
          </div>
        )}

        <OutgroupCalibrationBanner validation={liveObj.outgroup_validation} />

        {selected?.mechanistic_chain && (
          <MechanisticChainPanel
            chain={selected.mechanistic_chain}
            className="mt-4"
          />
        )}

        {liveObj.decision_brief && (
          <DecisionBriefPanel
            brief={liveObj.decision_brief}
            searchQuery={liveObj.search_query ?? "Discovery program"}
            className="mt-4"
            onEvidenceCardClick={(id) => {
              document.getElementById(`evidence-card-${id}`)?.scrollIntoView({
                behavior: "smooth",
                block: "center",
              });
            }}
          />
        )}

        {status === "paused" && liveObj.decision_brief && (
          <div className="mt-3 rounded-lg border border-brand-teal/30 bg-brand-teal/5 px-4 py-2 text-xs text-brand-teal">
            Discovery complete — surveillance paused. Resume when you want live monitoring.
          </div>
        )}

        {status === "paused" && !liveObj.decision_brief && (
          <div className="mt-3 rounded-lg border border-amber-200/80 bg-amber-50 px-4 py-2 text-xs text-amber-800">
            Discovery paused mid-run. Resume to finish ranking and decision brief.
          </div>
        )}

        {status === "agents_running" && lastAgentStatus && (
          <div className="mt-3 rounded-lg border border-brand-purple/20 bg-brand-purple/5 px-4 py-2 text-xs text-brand-purple">
            Running {lastAgentStatus.agent.replace(/_/g, " ")}
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-6">
            <OpportunityHeader
              searchQuery={liveObj.search_query}
              hypothesis={selected ? {
                statement: selected.statement,
                patient_population: selected.patient_population,
                unmet_need: selected.unmet_need,
                org_positioning: selected.org_positioning,
              } : liveObj.hypothesis}
              status={status}
            />
            <HypothesisRankList
              hypotheses={hypotheses}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
            {selected && (
              <HypothesisDetailPanel
                hypothesis={selected}
                status={status}
                evidenceTier={liveObj.evidence_tier}
              />
            )}
            <PrioritizedTargetsPanel cards={filteredCards} />
            <SessionSummaryPanel
              cards={filteredCards}
              confidenceScore={displayConfidence}
              actionabilityZone={displayZone}
            />
            <OpportunityTrailsPanel
              hypothesisIdFilter={selectedId}
              onResume={async () => {
                await handleResume();
                if (useOpportunityStore.getState().status === "agents_running") {
                  reconnect();
                }
              }}
              resuming={resuming}
            />
          </div>

          <aside className="space-y-4 lg:sticky lg:top-[73px] lg:self-start">
            <ScoreStrip
              confidenceScore={displayConfidence}
              actionabilityZone={displayZone}
              scoreDecomposition={
                selected?.score_decomposition ?? liveObj.decision_brief?.score_decomposition
              }
            />
            <ModalityPanel cards={filteredCards} />
          </aside>
        </div>
      </PageContent>
    </>
  );
}
