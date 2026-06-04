"use client";

import { useEffect, useRef, useCallback } from "react";
import { useOpportunityStore } from "@/store/opportunityStore";
import type { BlackboardAgentEvent, EvidenceCard } from "@/types/OpportunityObject";

export function useOpportunityStream(opportunityId: string) {
  const { addCard, updateScores, setStreaming, setAgentStatus, setBlackboardError } =
    useOpportunityStore();
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setStreaming(true);
    setBlackboardError(null);
    const es = new EventSource(`/api/stream/${opportunityId}`);
    eventSourceRef.current = es;

    es.addEventListener("card", (event) => {
      try {
        const card = JSON.parse(event.data) as EvidenceCard;
        addCard(card);
      } catch (err) {
        console.error("SSE card parse error:", err);
      }
    });

    es.addEventListener("agent_status", (event) => {
      try {
        const data = JSON.parse(event.data) as BlackboardAgentEvent;
        setAgentStatus(data);
      } catch (err) {
        console.error("SSE agent_status parse error:", err);
      }
    });

    es.addEventListener("score", (event) => {
      try {
        const data = JSON.parse(event.data);
        updateScores(data);
        if (data.blackboard_error) {
          setBlackboardError(data.blackboard_error);
        }
      } catch (err) {
        console.error("SSE score parse error:", err);
      }
    });

    es.addEventListener("complete", (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.status) {
          updateScores({
            confidence_score: useOpportunityStore.getState().confidenceScore,
            actionability_score: useOpportunityStore.getState().actionabilityScore,
            actionability_zone: useOpportunityStore.getState().actionabilityZone,
            status: data.status,
          });
        }
      } catch {
        /* optional payload */
      }
      setStreaming(false);
      es.close();
    });

    es.addEventListener("failed", (event) => {
      try {
        const data = JSON.parse(event.data);
        setBlackboardError(data.message ?? "Discovery pipeline failed");
        updateScores({
          confidence_score: useOpportunityStore.getState().confidenceScore,
          actionability_score: useOpportunityStore.getState().actionabilityScore,
          actionability_zone: useOpportunityStore.getState().actionabilityZone,
          status: "agents_failed",
        });
      } catch {
        setBlackboardError("Discovery pipeline failed");
      }
      setStreaming(false);
      es.close();
    });

    es.addEventListener("paused", () => {
      setStreaming(false);
    });

    es.addEventListener("error", (event) => {
      if (event instanceof MessageEvent && event.data) {
        try {
          const data = JSON.parse(event.data);
          setBlackboardError(data.message ?? "Stream error");
        } catch {
          setBlackboardError("Stream error");
        }
      }
      setStreaming(false);
    });

    es.onerror = () => {
      setStreaming(false);
    };
  }, [
    opportunityId,
    addCard,
    updateScores,
    setStreaming,
    setAgentStatus,
    setBlackboardError,
  ]);

  useEffect(() => {
    connect();
    return () => {
      eventSourceRef.current?.close();
      setStreaming(false);
    };
  }, [connect, setStreaming]);

  return { reconnect: connect };
}
