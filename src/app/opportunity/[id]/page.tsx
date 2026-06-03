"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { PageContent } from "@/components/layout/PageContent";
import { Panel } from "@/components/layout/Panel";
import { HypothesisPanel } from "@/components/opportunity/HypothesisPanel";
import { OpportunityFeed } from "@/components/opportunity/OpportunityFeed";
import { ConfidenceGauge } from "@/components/opportunity/ConfidenceGauge";
import { ActionabilityZoneBar } from "@/components/opportunity/ActionabilityZone";
import { SurveillanceTagsDisplay } from "@/components/opportunity/SurveillanceTags";
import { SurveillancePauseButton } from "@/components/opportunity/SurveillancePanel";
import { useOpportunityStream } from "@/hooks/useOpportunityStream";
import { useOpportunityStore } from "@/store/opportunityStore";
import type { OpportunityObject } from "@/types/OpportunityObject";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { OctagonPause } from "lucide-react";
import type { ChangeLogEntry } from "@/types/OpportunityObject";
import { SESSIONS_UPDATED_EVENT, notifyOpportunitiesUpdated } from "@/lib/events";

export default function OpportunityPage() {
  const params = useParams();
  const id = params.id as string;
  const { reconnect } = useOpportunityStream(id);
  const {
    opportunity,
    setOpportunity,
    confidenceScore,
    actionabilityScore,
    actionabilityZone,
    status,
    streamingCards,
    addCard,
    lastSurveillanceCheck,
    pauseSession,
    resumeSession,
  } = useOpportunityStore();

  const [scoreHistory, setScoreHistory] = useState<
    Array<{ time: string; score: number }>
  >([]);
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [resuming, setResuming] = useState(false);
  const lastRecordedScore = useRef<number | null>(null);

  const canStopAgents = status === "agents_running";

  const handlePauseSurveillance = useCallback(async () => {
    if (pausing) return;
    setPausing(true);
    try {
      const res = await fetch(`/api/opportunity/${id}/pause`, { method: "POST" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        changeLogEntry?: ChangeLogEntry;
        alreadyPaused?: boolean;
      };
      if (data.changeLogEntry) {
        pauseSession(data.changeLogEntry);
      }
    } catch (err) {
      console.error("Pause failed:", err);
    } finally {
      setPausing(false);
    }
  }, [id, pausing, pauseSession]);

  const reloadOpportunity = useCallback(async () => {
    const res = await fetch(`/api/opportunity/${id}`, { cache: "no-store" });
    const data = (await res.json()) as OpportunityObject & { error?: string };
    if (!data.id) return;
    setOpportunity(data);
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
  }, [id, setOpportunity, addCard]);

  const handleResume = useCallback(async () => {
    if (resuming || status !== "paused") return;
    setResuming(true);
    try {
      const res = await fetch(`/api/opportunity/${id}/resume`, { method: "POST" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        resumed?: boolean;
        alreadyActive?: boolean;
        changeLogEntry?: ChangeLogEntry;
      };
      if (data.changeLogEntry) {
        resumeSession(data.changeLogEntry);
      } else if (data.resumed) {
        resumeSession({
          timestamp: new Date().toISOString(),
          trigger: "user_resumed",
          agents_reinitiated: [],
          summary: "Surveillance resumed",
        });
      }
      await reloadOpportunity();
      window.dispatchEvent(new CustomEvent(SESSIONS_UPDATED_EVENT));
      notifyOpportunitiesUpdated();
    } catch (err) {
      console.error("Resume failed:", err);
    } finally {
      setResuming(false);
    }
  }, [id, resuming, status, reloadOpportunity, resumeSession]);

  useEffect(() => {
    const onSessionsUpdated = () => reloadOpportunity();
    window.addEventListener(SESSIONS_UPDATED_EVENT, onSessionsUpdated);
    return () =>
      window.removeEventListener(SESSIONS_UPDATED_EVENT, onSessionsUpdated);
  }, [reloadOpportunity]);

  useEffect(() => {
    setScoreHistory([]);
    lastRecordedScore.current = null;
  }, [id]);

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

  useEffect(() => {
    if (confidenceScore <= 0) return;
    if (lastRecordedScore.current === confidenceScore) return;

    lastRecordedScore.current = confidenceScore;
    setScoreHistory((prev) =>
      [
        ...prev,
        {
          time: new Date().toLocaleTimeString(),
          score: confidenceScore,
        },
      ].slice(-24)
    );
  }, [confidenceScore]);

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
  const evidenceCount = streamingCards.filter((c) => !c.is_challenge).length;
  const challengeCount = streamingCards.filter((c) => c.is_challenge).length;

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
            <SurveillancePauseButton
              status={status}
              pausing={pausing}
              resuming={resuming}
              onPause={handlePauseSurveillance}
              onResume={handleResume}
            />
            {canStopAgents && (
              <Button
                size="sm"
                variant="destructive"
                className="bg-brand-coral hover:bg-brand-coral/90"
                onClick={handlePauseSurveillance}
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
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6 min-w-0">
            <HypothesisPanel
              hypothesis={obj.hypothesis}
              status={status}
              searchQuery={obj.search_query}
              mode={obj.mode}
              evidenceTier={obj.evidence_tier}
              scoreHistory={scoreHistory}
            />
            <OpportunityFeed onResume={handleResume} resuming={resuming} />
          </div>

          <aside className="space-y-4 lg:sticky lg:top-[73px] lg:self-start">
            <Panel title="Scores">
              <div className="space-y-5">
                <ConfidenceGauge
                  score={confidenceScore}
                  zone={actionabilityZone}
                  preliminary={
                    obj.mode === "speed" &&
                    status !== "complete" &&
                    status !== "surveillance" &&
                    status !== "paused"
                  }
                />
                <ActionabilityZoneBar zone={actionabilityZone} score={actionabilityScore} />
              </div>
            </Panel>

            <Panel title="Session">
              <dl className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg bg-gray-50 py-2">
                  <dt className="text-[10px] uppercase tracking-wide text-gray-400">Cards</dt>
                  <dd className="text-lg font-semibold text-gray-900">{evidenceCount}</dd>
                </div>
                <div className="rounded-lg bg-gray-50 py-2">
                  <dt className="text-[10px] uppercase tracking-wide text-gray-400">Challenges</dt>
                  <dd className="text-lg font-semibold text-brand-coral">{challengeCount}</dd>
                </div>
                <div className="rounded-lg bg-gray-50 py-2">
                  <dt className="text-[10px] uppercase tracking-wide text-gray-400">Agents</dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {new Set(streamingCards.map((c) => c.contributing_agent)).size}
                  </dd>
                </div>
              </dl>
              {status === "agents_running" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 w-full"
                  onClick={reconnect}
                >
                  Reconnect stream
                </Button>
              )}
            </Panel>

            {(status === "surveillance" || status === "complete") &&
              obj.surveillance_tags && (
              <SurveillanceTagsDisplay
                tags={obj.surveillance_tags}
                lastCheckedAt={lastSurveillanceCheck}
              />
            )}
          </aside>
        </div>
      </PageContent>
    </>
  );
}
