"use client";

import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import { useOpportunityStore } from "@/store/opportunityStore";
import type { ChangeLogEntry, OpportunityObject } from "@/types/OpportunityObject";
import { SESSIONS_UPDATED_EVENT, notifyOpportunitiesUpdated } from "@/lib/events";

export function useSurveillanceSessionControls() {
  const params = useParams();
  const id = params.id as string;
  const { status, pauseSession, resumeSession, setOpportunity, addCard } =
    useOpportunityStore();
  const [pausing, setPausing] = useState(false);
  const [resuming, setResuming] = useState(false);

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

  const handlePause = useCallback(async () => {
    if (pausing) return;
    setPausing(true);
    try {
      const res = await fetch(`/api/opportunity/${id}/pause`, { method: "POST" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        changeLogEntry?: ChangeLogEntry;
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

  const handleResume = useCallback(async () => {
    if (resuming || status !== "paused") return;
    setResuming(true);
    try {
      const res = await fetch(`/api/opportunity/${id}/resume`, { method: "POST" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        resumed?: boolean;
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

  return { pausing, resuming, handlePause, handleResume, reloadOpportunity };
}
