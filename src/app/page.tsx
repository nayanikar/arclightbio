"use client";

import { useMemo } from "react";
import { PageContent } from "@/components/layout/PageContent";
import { MetricCards } from "@/components/dashboard/MetricCards";
import { FeaturedOpportunityCard } from "@/components/dashboard/FeaturedOpportunityCard";
import { SecondaryOpportunityCard } from "@/components/dashboard/SecondaryOpportunityCard";
import { AllOpportunitiesList } from "@/components/dashboard/AllOpportunitiesList";
import { DashboardFooterStatusBar } from "@/components/dashboard/DashboardFooterStatusBar";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { Button } from "@/components/ui/button";
import { TopBar } from "@/components/layout/TopBar";
import { useDashboardPoll } from "@/hooks/useDashboardPoll";
import { useDashboardStore } from "@/store/dashboardStore";
import {
  computeDashboardMetrics,
  filterDashboardOpportunities,
  selectDashboardSlots,
} from "@/lib/dashboardLayout";
import Link from "next/link";
import { Plus } from "lucide-react";

export default function DashboardPage() {
  useDashboardPoll();

  const opportunities = useDashboardStore((s) => s.opportunities);
  const loading = useDashboardStore((s) => s.loading);
  const hydrated = useDashboardStore((s) => s.hydrated);

  const nonArchived = useMemo(
    () => filterDashboardOpportunities(opportunities),
    [opportunities]
  );

  const metrics = useMemo(
    () => computeDashboardMetrics(nonArchived),
    [nonArchived]
  );

  const slots = useMemo(
    () => selectDashboardSlots(nonArchived),
    [nonArchived]
  );

  const showSkeleton = loading && nonArchived.length === 0;
  const showEmpty = hydrated && !loading && nonArchived.length === 0;

  return (
    <>
      <TopBar
        title="Opportunity queue"
        subtitle="Live discovery sessions across your portfolio"
        badge={
          <Link href="/discover">
            <Button size="sm" className="bg-brand-purple hover:bg-brand-purple/90">
              <Plus className="mr-2 h-4 w-4" />
              New discovery
            </Button>
          </Link>
        }
      />

      <PageContent className="space-y-3">
        <MetricCards metrics={metrics} loading={loading && !hydrated} />

        {showSkeleton ? (
          <DashboardSkeleton />
        ) : showEmpty ? (
          <div
            className="rounded-xl border border-dashed bg-white px-8 py-12 text-center"
            style={{ borderColor: "var(--color-border-tertiary)" }}
          >
            <p
              className="text-sm"
              style={{ color: "var(--color-text-secondary)" }}
            >
              No discovery sessions yet.
            </p>
            <Link href="/discover">
              <Button variant="outline" size="sm" className="mt-4">
                Start your first discovery
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {slots.featured && (
                <FeaturedOpportunityCard
                  opportunity={slots.featured}
                  className="col-span-2"
                />
              )}
              {slots.secondaryLeft && (
                <SecondaryOpportunityCard opportunity={slots.secondaryLeft} />
              )}
              {slots.secondaryRight && (
                <SecondaryOpportunityCard opportunity={slots.secondaryRight} />
              )}
            </div>

            <AllOpportunitiesList opportunities={slots.remaining} />

            <DashboardFooterStatusBar opportunities={nonArchived} />
          </>
        )}
      </PageContent>
    </>
  );
}
