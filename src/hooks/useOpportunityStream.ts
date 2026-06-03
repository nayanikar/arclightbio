"use client";

import { useEffect, useRef, useCallback } from "react";
import { useOpportunityStore } from "@/store/opportunityStore";
import type { EvidenceCard } from "@/types/OpportunityObject";

export function useOpportunityStream(opportunityId: string) {
  const { addCard, updateScores, setStreaming } = useOpportunityStore();
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setStreaming(true);
    const es = new EventSource(`/api/stream/${opportunityId}`);
    eventSourceRef.current = es;

    es.addEventListener("card", (event) => {
      const card = JSON.parse(event.data) as EvidenceCard;
      addCard(card);
    });

    es.addEventListener("score", (event) => {
      const data = JSON.parse(event.data);
      updateScores(data);
    });

    es.addEventListener("complete", () => {
      setStreaming(false);
      es.close();
    });

    es.addEventListener("error", () => {
      setStreaming(false);
    });

    es.onerror = () => {
      setStreaming(false);
    };
  }, [opportunityId, addCard, updateScores, setStreaming]);

  useEffect(() => {
    connect();
    return () => {
      eventSourceRef.current?.close();
      setStreaming(false);
    };
  }, [connect, setStreaming]);

  return { reconnect: connect };
}
