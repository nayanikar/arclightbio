"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Minus,
  X,
} from "lucide-react";
import type { ActionabilityZone } from "@/types/OpportunityObject";
import type { SurveillanceStep } from "@/types/surveillanceProgress";
import { formatLastChecked } from "@/components/opportunity/ChangeLogSection";
import { SURVEILLANCE_POLL_INTERVAL_MS } from "@/config/surveillance";
import { useSurveillanceScan } from "@/hooks/useSurveillanceScan";
import { useOpportunityStore } from "@/store/opportunityStore";
import { cn } from "@/lib/utils";

const ZONE_LABELS: Record<ActionabilityZone, string> = {
  act_now: "Act now",
  too_early: "Too early",
  crowded: "Crowded",
};

function StepIcon({ step }: { step: SurveillanceStep }) {
  if (step.icon === "scanning") {
    return <Loader2 className="h-3 w-3 shrink-0 animate-spin text-brand-amber" />;
  }
  if (step.icon === "relevant") {
    return <Check className="h-3 w-3 shrink-0 text-brand-teal" />;
  }
  if (step.icon === "filtered") {
    return <X className="h-3 w-3 shrink-0 text-white/25" />;
  }
  return <Minus className="h-3 w-3 shrink-0 text-white/25" />;
}

interface SurveillanceRailProps {
  onResume?: () => void;
  resuming?: boolean;
  variant?: "sidebar" | "main";
  embedded?: boolean;
}

export function SurveillanceRail({
  onResume,
  resuming,
  variant = "sidebar",
  embedded = false,
}: SurveillanceRailProps) {
  const params = useParams();
  const opportunityId = params.id as string;
  const { status, actionabilityZone, lastSurveillanceCheck, changeLog } =
    useOpportunityStore();
  const isMain = variant === "main";

  const showSurveillance =
    status === "surveillance" ||
    status === "complete" ||
    status === "paused" ||
    (isMain && (status === "agents_running" || status === "initialising"));

  const surveillanceActive = status === "surveillance" || status === "complete";
  const { steps, summary, isScanning, countdown } = useSurveillanceScan(
    opportunityId,
    surveillanceActive,
    status === "paused"
  );

  const [expanded, setExpanded] = useState(
    isMain || status === "surveillance" || isScanning
  );

  if (!showSurveillance) return null;

  const isPaused = status === "paused";
  const pendingDiscovery =
    isMain && (status === "agents_running" || status === "initialising");
  const pollSeconds = Math.floor(SURVEILLANCE_POLL_INTERVAL_MS / 1000);
  const displaySteps = [...steps]
    .reverse()
    .slice(0, embedded || expanded ? undefined : 0);
  const lastScanLabel = formatLastChecked(lastSurveillanceCheck).replace(
    "Last checked:",
    "Last scan:"
  );

  const statusChip = pendingDiscovery ? (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 font-medium",
        isMain ? "bg-gray-100 text-xs text-gray-500" : "bg-white/10 text-[10px] text-white/50"
      )}
    >
      Pending
    </span>
  ) : isPaused ? (
    <span
      className={cn(
        "rounded-full px-2 py-0.5",
        isMain ? "bg-gray-100 text-xs text-gray-500" : "bg-white/10 text-[10px] text-white/50"
      )}
    >
      Paused
    </span>
  ) : isScanning ? (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium animate-pulse",
        isMain
          ? "bg-brand-amber/15 text-xs text-brand-amber"
          : "bg-brand-amber/20 text-[10px] text-brand-amber"
      )}
    >
      Scanning
    </span>
  ) : (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 font-medium",
        isMain ? "bg-brand-teal/10 text-xs text-brand-teal" : "bg-brand-teal/20 text-[10px] text-brand-teal"
      )}
    >
      Watching
    </span>
  );

  const trailBody = (
    <>
      {pendingDiscovery && (
        <p className={cn("py-6 text-center", isMain ? "px-5 text-sm text-gray-400" : "text-[10px] text-white/30")}>
          Surveillance begins when the blackboard pipeline completes.
        </p>
      )}

      {!pendingDiscovery && isPaused && (
        <div
          className={cn(
            "mb-3 rounded-lg px-3 py-2 text-xs text-brand-amber",
            isMain ? "mx-5 bg-brand-amber/10" : "rounded-md bg-brand-amber/10 px-2 py-1.5 text-[10px]"
          )}
        >
          Paused ·{" "}
          <button
            type="button"
            onClick={onResume}
            disabled={resuming}
            className="underline underline-offset-2"
          >
            {resuming ? "Resuming…" : "Resume"}
          </button>
        </div>
      )}

      {!pendingDiscovery && (
        <>
          <p className={cn("mb-3", isMain ? "px-5 text-xs text-gray-400" : "mb-2 text-[10px] text-white/30")}>
            {lastScanLabel}
          </p>

          {displaySteps.length === 0 && !isScanning && (
            <p
              className={cn(
                "py-6 text-center",
                isMain ? "px-5 text-sm text-gray-400" : "text-[10px] text-white/30"
              )}
            >
              {isPaused ? "Surveillance paused." : "Waiting for next scan…"}
            </p>
          )}

          <div className={cn("space-y-2", isMain ? "px-5 pb-2" : "space-y-1")}>
            {displaySteps.map((step) => (
              <div key={step.id} className="flex items-start gap-2.5 py-1">
                <StepIcon step={step} />
                <p
                  className={cn(
                    "leading-relaxed",
                    isMain ? "text-sm" : "text-[10px] leading-relaxed",
                    step.positive && (isMain ? "text-brand-teal" : "text-brand-teal"),
                    step.muted && !step.positive && (isMain ? "text-gray-400" : "text-white/30"),
                    !step.muted && !step.positive && (isMain ? "text-gray-600" : "text-white/60")
                  )}
                >
                  {step.description}
                </p>
              </div>
            ))}
          </div>

          {summary && (
            <p
              className={cn(
                "mt-3 border-t pt-3",
                isMain ? "mx-5 border-[#EDE8E0] text-sm" : "mt-2 border-white/5 text-[10px]",
                summary.positive ? "text-brand-teal" : isMain ? "text-gray-400" : "text-white/30"
              )}
            >
              {summary.message}
              {summary.positive &&
                summary.newCardIds.map((cardId, i) => (
                  <Link
                    key={cardId}
                    href={`#card-${cardId}`}
                    className="ml-1 underline underline-offset-2"
                  >
                    {i > 0 ? " · " : ""}View
                  </Link>
                ))}
            </p>
          )}

          {!isPaused && (
            <p className={cn("mt-3", isMain ? "px-5 text-xs text-gray-400" : "mt-2 text-[10px] text-white/25")}>
              Every {pollSeconds}s · Next {isScanning ? "…" : `${countdown}s`} ·{" "}
              {ZONE_LABELS[actionabilityZone]}
            </p>
          )}

          {changeLog.length > 0 && (
            <p className={cn("mt-2", isMain ? "px-5 pb-4 text-xs text-gray-400" : "text-[10px] text-white/25")}>
              {changeLog.length} change log entr{changeLog.length === 1 ? "y" : "ies"}
            </p>
          )}
        </>
      )}
    </>
  );

  if (embedded) {
    return (
      <div>
        <div
          className={cn(
            "flex items-center justify-between border-b px-5 py-2.5",
            isMain ? "border-[#EDE8E0] bg-gray-50/40" : "border-white/10"
          )}
        >
          <p className={cn(isMain ? "text-xs text-gray-500" : "text-[10px] text-white/30")}>
            {pendingDiscovery
              ? "Awaiting discovery"
              : isScanning
                ? "Scan in progress"
                : `Next scan in ${countdown}s`}
          </p>
          {statusChip}
        </div>
        {trailBody}
      </div>
    );
  }

  return (
    <div className="shrink-0 border-t border-white/10">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-white/5"
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50">
            Surveillance
          </p>
          {!expanded && (
            <p className="mt-0.5 text-[10px] text-white/30">
              {isPaused
                ? "Paused"
                : isScanning
                  ? "Scanning now…"
                  : `Next in ${countdown}s · ${ZONE_LABELS[actionabilityZone]}`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {statusChip}
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-white/40" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-white/40" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="max-h-[240px] overflow-y-auto border-t border-white/5 px-3 py-2">
          {trailBody}
        </div>
      )}
    </div>
  );
}
