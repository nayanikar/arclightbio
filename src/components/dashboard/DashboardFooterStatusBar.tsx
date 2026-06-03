import type { OpportunityObject } from "@/types/OpportunityObject";
import { getLastScanMinutesAgo } from "@/lib/dashboardLayout";

interface DashboardFooterStatusBarProps {
  opportunities: OpportunityObject[];
}

export function DashboardFooterStatusBar({
  opportunities,
}: DashboardFooterStatusBarProps) {
  const minutesAgo = getLastScanMinutesAgo(opportunities);
  const scanLabel =
    minutesAgo === null
      ? "no recent activity"
      : minutesAgo < 1
        ? "just now"
        : minutesAgo === 1
          ? "1 min ago"
          : `${minutesAgo} min ago`;

  return (
    <div className="mt-2.5 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="inline-block h-1.5 w-1.5 animate-lp rounded-full bg-[#1D9E75]" />
        <span
          className="text-[11px]"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          Surveillance active · last scan {scanLabel}
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
