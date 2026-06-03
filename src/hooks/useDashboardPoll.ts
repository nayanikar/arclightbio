"use client";

import { useEffect } from "react";
import { SURVEILLANCE_POLL_INTERVAL_MS } from "@/config/surveillance";
import {
  OPPORTUNITIES_UPDATED_EVENT,
  SESSIONS_UPDATED_EVENT,
} from "@/lib/events";
import { useDashboardStore } from "@/store/dashboardStore";

export function useDashboardPoll() {
  const fetchOpportunities = useDashboardStore((s) => s.fetchOpportunities);
  const rehydrateFromCache = useDashboardStore((s) => s.rehydrateFromCache);

  useEffect(() => {
    rehydrateFromCache();
    fetchOpportunities();

    const interval = window.setInterval(
      fetchOpportunities,
      SURVEILLANCE_POLL_INTERVAL_MS
    );

    const onUpdate = () => fetchOpportunities();
    window.addEventListener(OPPORTUNITIES_UPDATED_EVENT, onUpdate);
    window.addEventListener(SESSIONS_UPDATED_EVENT, onUpdate);
    window.addEventListener("focus", onUpdate);

    const onVisible = () => {
      if (document.visibilityState === "visible") fetchOpportunities();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener(OPPORTUNITIES_UPDATED_EVENT, onUpdate);
      window.removeEventListener(SESSIONS_UPDATED_EVENT, onUpdate);
      window.removeEventListener("focus", onUpdate);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchOpportunities, rehydrateFromCache]);
}
