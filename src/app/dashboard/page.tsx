"use client";

import { useMemo } from "react";
import { PageContent } from "@/components/layout/PageContent";
import { PortfolioSummary } from "@/components/dashboard/PortfolioSummary";
import { ProgramQueueToolbar } from "@/components/dashboard/ProgramQueueToolbar";
import { ProgramQueue } from "@/components/dashboard/ProgramQueue";
import { DashboardFooterStatusBar } from "@/components/dashboard/DashboardFooterStatusBar";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { Button } from "@/components/ui/button";
import { TopBar } from "@/components/layout/TopBar";
import { useDashboardPoll } from "@/hooks/useDashboardPoll";
import { useDashboardSort } from "@/hooks/useDashboardSort";
import { useDashboardStore } from "@/store/dashboardStore";
import {
  buildDashboardProgramViews,
  computeDashboardMetrics,
  filterDashboardOpportunities,
  sortDashboardPrograms,
} from "@/lib/dashboardDisplay";
import Link from "next/link";
import { Plus } from "lucide-react";

export default function DashboardPage() {
  useDashboardPoll();

  const opportunities = useDashboardStore((s) => s.opportunities);
  const loading = useDashboardStore((s) => s.loading);
  const hydrated = useDashboardStore((s) => s.hydrated);
  const { sortKey, setSortKey } = useDashboardSort();

  const nonArchived = useMemo(
    () => filterDashboardOpportunities(opportunities),
    [opportunities]
  );

  const metrics = useMemo(
    () => computeDashboardMetrics(nonArchived),
    [nonArchived]
  );

  const programViews = useMemo(
    () => buildDashboardProgramViews(nonArchived),
    [nonArchived]
  );

  const sortedPrograms = useMemo(
    () => sortDashboardPrograms(programViews, sortKey, "desc"),
    [programViews, sortKey]
  );

  const showSkeleton = loading && nonArchived.length === 0;
  const showEmpty = hydrated && !loading && nonArchived.length === 0;

  return (
    <>
      <TopBar
        title="Discovery programs"
        subtitle="Discovery programs across your portfolio"
        badge={
          <Link href="/discover">
            <Button
              size="sm"
              className="bg-[var(--v3-teal)] hover:bg-[var(--v3-teal-light)]"
            >
              <Plus className="mr-2 h-4 w-4" />
              New discovery
            </Button>
          </Link>
        }
      />

      <PageContent flush className="space-y-5">
        <PortfolioSummary
          metrics={metrics}
          loading={loading}
          hydrated={hydrated}
        />

        {showSkeleton ? (
          <DashboardSkeleton />
        ) : showEmpty ? (
          <div
            className="dashboard-queue rounded-xl border border-dashed px-8 py-12 text-center"
            style={{ borderColor: "rgba(15, 26, 46, 0.15)" }}
          >
            <p
              className="text-sm"
              style={{ color: "var(--color-text-secondary)" }}
            >
              No discovery programs yet.
            </p>
            <Link href="/discover">
              <Button
                variant="outline"
                size="sm"
                className="mt-4 border-[var(--v3-teal)] text-[var(--v3-teal)]"
              >
                Start your first discovery
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <ProgramQueueToolbar
              sortKey={sortKey}
              onSortChange={setSortKey}
              count={sortedPrograms.length}
            />
            <ProgramQueue programs={sortedPrograms} />
            <div className="pt-1">
              <DashboardFooterStatusBar opportunities={nonArchived} />
            </div>
          </>
        )}
      </PageContent>
    </>
  );
}
