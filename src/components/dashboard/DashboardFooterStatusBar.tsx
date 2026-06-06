import type { OpportunityObject } from "@/types/OpportunityObject";
import { getLastScanMinutesAgo } from "@/lib/dashboardLayout";

interface DashboardFooterStatusBarProps {
  opportunities: OpportunityObject[];
}

function formatActivityLabel(minutesAgo: number | null): string {
  if (minutesAgo === null) return "no recent activity";
  if (minutesAgo < 1) return "just now";
  if (minutesAgo === 1) return "1 min ago";
  return `${minutesAgo} min ago`;
}

export function DashboardFooterStatusBar({
  opportunities,
}: DashboardFooterStatusBarProps) {
  const running = opportunities.filter(
    (o) => o.status === "agents_running"
  ).length;
  const paused = opportunities.filter((o) => o.status === "paused").length;
  const surveillance = opportunities.filter(
    (o) => o.status === "surveillance"
  ).length;
  const failed = opportunities.filter(
    (o) => o.status === "agents_failed"
  ).length;

  const minutesAgo = getLastScanMinutesAgo(opportunities);
  const activityLabel = formatActivityLabel(minutesAgo);

  const statusParts: string[] = [];
  if (running > 0) {
    statusParts.push(`${running} running`);
  }
  if (paused > 0) {
    statusParts.push(`${paused} paused`);
  }
  if (surveillance > 0) {
    statusParts.push(`${surveillance} in surveillance`);
  }
  if (failed > 0) {
    statusParts.push(`${failed} failed`);
  }

  const statusSummary =
    statusParts.length > 0 ? statusParts.join(" · ") : "No active pipelines";

  const showPulse = running > 0 || surveillance > 0;

  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        {showPulse && (
          <span
            className="inline-block h-1.5 w-1.5 animate-lp rounded-full"
            style={{ background: "var(--v3-teal)" }}
          />
        )}
        <span
          className="text-[11px]"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          {statusSummary} · last activity {activityLabel}
        </span>
      </div>

      <span
        className="text-[11px]"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        Act now window: 30%–75% confidence
      </span>
    </div>
  );
}
