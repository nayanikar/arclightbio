"use client";

import { useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import type { AgentTrailEntry } from "@/types/AgentTrail";
import { useOpportunityStore } from "@/store/opportunityStore";

export function useAuditTrail(hypothesisId?: string) {
  const params = useParams();
  const id = params.id as string;
  const { setTrailEntries, trailEntries } = useOpportunityStore();

  const loadTrail = useCallback(async () => {
    const query = hypothesisId
      ? `?hypothesisId=${encodeURIComponent(hypothesisId)}`
      : "";
    const res = await fetch(`/api/opportunity/${id}/trail${query}`, {
      cache: "no-store",
    });
    if (!res.ok) return;
    const data = (await res.json()) as { entries?: AgentTrailEntry[] };
    if (data.entries) {
      setTrailEntries(data.entries);
    }
  }, [id, hypothesisId, setTrailEntries]);

  useEffect(() => {
    void loadTrail();
  }, [loadTrail]);

  return { trailEntries, reloadTrail: loadTrail };
}
