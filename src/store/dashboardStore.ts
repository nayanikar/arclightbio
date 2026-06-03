"use client";

import type { OpportunityObject } from "@/types/OpportunityObject";
import {
  fetchOpportunitiesFromApi,
  loadCachedOpportunities,
  sortDashboardOpportunities,
} from "@/lib/dashboardMetrics";
import { create } from "zustand";

interface DashboardState {
  opportunities: OpportunityObject[];
  loading: boolean;
  hydrated: boolean;
  lastFetchedAt: string | null;

  rehydrateFromCache: () => void;
  fetchOpportunities: () => Promise<void>;
  setOpportunities: (opportunities: OpportunityObject[]) => void;
  resumeOpportunity: (id: string) => Promise<boolean>;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  opportunities: [],
  loading: true,
  hydrated: false,
  lastFetchedAt: null,

  rehydrateFromCache: () => {
    const cached = loadCachedOpportunities();
    if (cached.length > 0) {
      set({ opportunities: cached, loading: true, hydrated: true });
    } else {
      set({ hydrated: true });
    }
  },

  fetchOpportunities: async () => {
    const { hydrated } = get();
    if (!hydrated) {
      get().rehydrateFromCache();
    }

    try {
      const fresh = await fetchOpportunitiesFromApi();
      set({
        opportunities: fresh,
        loading: false,
        hydrated: true,
        lastFetchedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Dashboard fetch failed:", err);
      const cached = loadCachedOpportunities();
      set({
        opportunities: cached.length > 0 ? cached : get().opportunities,
        loading: false,
        hydrated: true,
      });
    }
  },

  setOpportunities: (opportunities) =>
    set({
      opportunities: sortDashboardOpportunities(opportunities),
      lastFetchedAt: new Date().toISOString(),
    }),

  resumeOpportunity: async (id) => {
    const res = await fetch(`/api/opportunity/${id}/resume`, { method: "POST" });
    if (!res.ok) return false;
    await get().fetchOpportunities();
    return true;
  },
}));

export function useSortedOpportunities(): OpportunityObject[] {
  return useDashboardStore((s) => s.opportunities);
}
