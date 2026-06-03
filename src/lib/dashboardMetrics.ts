import type { OpportunityObject } from "@/types/OpportunityObject";
import {
  persistOpportunitySnapshots,
  rehydrateOpportunitiesFromCache,
} from "@/lib/opportunityCache";

const ZONE_PRIORITY: Record<OpportunityObject["actionability_zone"], number> = {
  act_now: 0,
  too_early: 1,
  crowded: 2,
};

export function sortDashboardOpportunities(
  opportunities: OpportunityObject[]
): OpportunityObject[] {
  return [...opportunities].sort((a, b) => {
    const timeDiff =
      new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime();
    if (timeDiff !== 0) return timeDiff;
    return (
      ZONE_PRIORITY[a.actionability_zone] - ZONE_PRIORITY[b.actionability_zone]
    );
  });
}

export function isActiveOpportunity(status: OpportunityObject["status"]): boolean {
  return status === "surveillance" || status === "complete";
}

export function isMetricEligible(status: OpportunityObject["status"]): boolean {
  return status !== "archived" && status !== "paused";
}

export function formatUpdatedAgo(lastUpdated: string): string {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(lastUpdated).getTime()) / 60_000)
  );
  if (minutes < 1) return "Updated just now";
  if (minutes === 1) return "Updated 1 min ago";
  if (minutes < 60) return `Updated ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return "Updated 1 hour ago";
  return `Updated ${hours} hours ago`;
}

export async function fetchOpportunitiesFromApi(): Promise<OpportunityObject[]> {
  const res = await fetch("/api/opportunities", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load opportunities");
  const data = (await res.json()) as { opportunities?: OpportunityObject[] };
  const opportunities = data.opportunities ?? [];
  persistOpportunitySnapshots(opportunities);
  return sortDashboardOpportunities(opportunities);
}

export function loadCachedOpportunities(): OpportunityObject[] {
  return sortDashboardOpportunities(rehydrateOpportunitiesFromCache());
}
