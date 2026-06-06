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
import { OpportunityTrailsPanel } from "@/components/opportunity/OpportunityTrailsPanel";
import { OpportunityTopBarActions } from "@/components/opportunity/OpportunityTopBarActions";
import { OpportunityPageV2 } from "@/components/opportunity/OpportunityPageV2";
import { OpportunityPageV3 } from "@/components/opportunity/OpportunityPageV3";
import { useOpportunityStream } from "@/hooks/useOpportunityStream";
import { useSurveillanceSessionControls } from "@/hooks/useSurveillanceSessionControls";
import { useOpportunityStore } from "@/store/opportunityStore";
import type { OpportunityObject } from "@/types/OpportunityObject";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { SESSIONS_UPDATED_EVENT } from "@/lib/events";

export default function OpportunityPage() {
  const params = useParams();
  const id = params.id as string;
  const { reconnect } = useOpportunityStream(id);
  const {
    opportunity,
    setOpportunity,
    confidenceScore,
    actionabilityZone,
    status,
    streamingCards,
    blackboardError,
  } = useOpportunityStore();
  const {
    pausing,
    resuming,
    pauseError,
    resumeError,
    handlePause,
    handleResume,
    reloadOpportunity,
  } = useSurveillanceSessionControls();

  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const reset = useOpportunityStore((s) => s.reset);

  useEffect(() => {
    reset();
    setLoaded(false);
    setNotFound(false);
  }, [id, reset]);

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
        setLoaded(true);
      })
      .catch(() => {
        setNotFound(true);
        setLoaded(true);
      });
  }, [id, setOpportunity]);

  if (!loaded || opportunity?.id !== id) {
    return (
      <>
        <TopBar subtitle="Loading session…" compact />
        <PageContent flush>
          <div className="animate-pulse space-y-6">
            <div className="h-40 rounded-xl bg-black/5" />
            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
              <div className="space-y-4">
                <div className="h-32 rounded-xl bg-black/5" />
                <div className="h-48 rounded-xl bg-black/5" />
                <div className="h-48 rounded-xl bg-black/5" />
              </div>
              <div className="h-64 rounded-xl bg-black/5" />
            </div>
          </div>
        </PageContent>
      </>
    );
  }

  if (notFound || !opportunity) {
    return (
      <>
        <TopBar title="Discovery program" subtitle="Session unavailable" compact />
        <PageContent flush>
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
              Discovery program not found
            </p>
            <p className="max-w-sm text-xs" style={{ color: "var(--color-text-tertiary)" }}>
              This session may have been deleted or the link is invalid.
            </p>
            <Link href="/discover">
              <Button size="sm" className="bg-brand-purple hover:bg-brand-purple/90">
                Start a new discovery
              </Button>
            </Link>
          </div>
        </PageContent>
      </>
    );
  }

  const obj = opportunity;
  const schemaVersion = obj.schema_version ?? 1;

  if (schemaVersion === 3) {
    return <OpportunityPageV3 obj={obj} id={id} reconnect={reconnect} />;
  }

  if (schemaVersion === 2) {
    return <OpportunityPageV2 obj={obj} id={id} reconnect={reconnect} />;
  }

  return (
    <>
      <TopBar
        title="Discovery session"
        subtitle={obj.search_query ?? obj.hypothesis.statement.slice(0, 120)}
        badge={
          <OpportunityTopBarActions
            id={id}
            status={status}
            mode={obj.mode}
            domainContext={obj.domain_context}
            actionabilityZone={actionabilityZone}
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
                <Link href="/discover" className="mt-2 inline-block text-xs font-medium underline">
                  Start a new discovery
                </Link>
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
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-6">
            <OpportunityHeader
              searchQuery={obj.search_query}
              hypothesis={obj.hypothesis}
              status={status}
            />
            <HypothesisPanel
              hypothesis={obj.hypothesis}
              status={status}
              evidenceTier={obj.evidence_tier}
            />
            <PrioritizedTargetsPanel cards={streamingCards} />
            <SessionSummaryPanel />
            <OpportunityTrailsPanel
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
              confidenceScore={confidenceScore}
              actionabilityZone={actionabilityZone}
            />
            <ModalityPanel cards={streamingCards} />
          </aside>
        </div>
      </PageContent>
    </>
  );
}
