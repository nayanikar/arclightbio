"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { PageContent } from "@/components/layout/PageContent";
import { OpportunityHeader } from "@/components/opportunity/OpportunityHeader";
import { PrioritizedTargetsPanel } from "@/components/opportunity/PrioritizedTargetsPanel";
import { HypothesisPanel } from "@/components/opportunity/HypothesisPanel";
import { SessionSummaryPanel } from "@/components/opportunity/SessionSummaryPanel";
import { ModalityPanel } from "@/components/opportunity/ModalityPanel";
import { ScoreStrip } from "@/components/opportunity/ScoreStrip";
import { AgentNodeGraph } from "@/components/opportunity/AgentNodeGraph";
import { MobileEvidenceDrawer } from "@/components/opportunity/MobileEvidenceDrawer";
import { SurveillancePauseButton } from "@/components/opportunity/SurveillancePanel";
import { useOpportunityStream } from "@/hooks/useOpportunityStream";
import { useSurveillanceSessionControls } from "@/hooks/useSurveillanceSessionControls";
import { useOpportunityStore } from "@/store/opportunityStore";
import type { OpportunityObject } from "@/types/OpportunityObject";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { OctagonPause } from "lucide-react";
import { domainContextLabel } from "@/lib/domainContext";
import { SESSIONS_UPDATED_EVENT } from "@/lib/events";

export default function OpportunityPage() {
  const params = useParams();
  const id = params.id as string;
  useOpportunityStream(id);
  const {
    opportunity,
    setOpportunity,
    confidenceScore,
    actionabilityZone,
    status,
    streamingCards,
    addCard,
  } = useOpportunityStore();
  const { pausing, resuming, handlePause, handleResume, reloadOpportunity } =
    useSurveillanceSessionControls();

  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const canStopAgents = status === "agents_running";

  useEffect(() => {
    const onSessionsUpdated = () => reloadOpportunity();
    window.addEventListener(SESSIONS_UPDATED_EVENT, onSessionsUpdated);
    return () =>
      window.removeEventListener(SESSIONS_UPDATED_EVENT, onSessionsUpdated);
  }, [reloadOpportunity]);

  useEffect(() => {
    fetch(`/api/opportunity/${id}`)
      .then((r) => r.json())
      .then((data: OpportunityObject & { error?: string }) => {
        if (!data.id) {
          setNotFound(true);
          setLoaded(true);
          return;
        }
        setOpportunity(data);
        for (const card of data.evidence_cards) {
          addCard(card);
        }
        for (const challenge of data.challenges) {
          addCard({
            id: challenge.id,
            content: challenge.content,
            source_url: "",
            source_type: "fda",
            contributing_agent: "regulatory",
            timestamp: new Date().toISOString(),
            quality_scores: {
              sample_size: 0.5,
              study_design: 0.5,
              source_credibility: 0.5,
              replication: 0.5,
              recency: 0.5,
              composite: 0.5,
            },
            regulatory_weight: 0.5,
            raw_source_metadata: {},
            is_challenge: true,
            challenge_metadata: {
              evidence_card_ref: challenge.evidence_card_ref,
              score_impact: challenge.score_impact,
              dimension: challenge.dimension,
            },
          });
        }
        setLoaded(true);
      })
      .catch(console.error);
  }, [id, setOpportunity, addCard]);

  if (!loaded && !opportunity) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-sm text-gray-400">Loading opportunity…</p>
      </div>
    );
  }

  if (notFound || !opportunity) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm font-medium text-gray-700">Opportunity not found</p>
        <p className="max-w-sm text-xs text-gray-400">
          This session may have been deleted or the link is invalid.
        </p>
        <Link href="/discover">
          <Button size="sm" className="bg-brand-purple hover:bg-brand-purple/90">
            Start a new discovery
          </Button>
        </Link>
      </div>
    );
  }

  const obj = opportunity;

  return (
    <>
      <TopBar
        title="Opportunity object"
        subtitle={obj.search_query ?? obj.hypothesis.statement.slice(0, 72)}
        badge={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="capitalize text-xs">
              {obj.mode ?? "speed"}
            </Badge>
            {obj.domain_context && obj.domain_context !== "general" && (
              <Badge
                variant="outline"
                className="text-xs border-brand-purple/40 text-brand-purple"
              >
                {domainContextLabel(obj.domain_context)}
              </Badge>
            )}
            <SurveillancePauseButton
              status={status}
              pausing={pausing}
              resuming={resuming}
              onPause={handlePause}
              onResume={handleResume}
            />
            {canStopAgents && (
              <Button
                size="sm"
                variant="destructive"
                className="bg-brand-coral hover:bg-brand-coral/90"
                onClick={handlePause}
                disabled={pausing}
              >
                <OctagonPause className="mr-2 h-4 w-4" />
                {pausing ? "Stopping…" : "Stop agents"}
              </Button>
            )}
            {actionabilityZone === "act_now" && (
              <Link href={`/opportunity/${id}/regulatory`}>
                <Button size="sm" className="bg-brand-teal hover:bg-brand-teal/90">
                  Regulatory package
                </Button>
              </Link>
            )}
          </div>
        }
      />

      <PageContent>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
          <div className="min-w-0 space-y-6">
            <OpportunityHeader
              searchQuery={obj.search_query}
              hypothesis={obj.hypothesis}
              status={status}
              mode={obj.mode}
              domainContext={obj.domain_context}
            />
            <PrioritizedTargetsPanel cards={streamingCards} />
            <HypothesisPanel
              hypothesis={obj.hypothesis}
              status={status}
              evidenceTier={obj.evidence_tier}
            />
            <SessionSummaryPanel />
          </div>

          <aside className="space-y-4 lg:sticky lg:top-[73px] lg:self-start">
            <ScoreStrip
              confidenceScore={confidenceScore}
              actionabilityZone={actionabilityZone}
            />
            <ModalityPanel cards={streamingCards} />
            <AgentNodeGraph />
          </aside>
        </div>
      </PageContent>

      <MobileEvidenceDrawer onResume={handleResume} resuming={resuming} />
    </>
  );
}
