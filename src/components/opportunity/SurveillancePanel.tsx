"use client";

import Link from "next/link";
import {
  Check,
  Loader2,
  Minus,
  Pause,
  Play,
  X,
} from "lucide-react";
import type {
  ActionabilityZone,
  ChangeLogEntry,
  OpportunityStatus,
} from "@/types/OpportunityObject";
import type {
  SurveillanceScanSummary,
  SurveillanceStep,
} from "@/types/surveillanceProgress";
import { ChangeLogSection, formatLastChecked } from "@/components/opportunity/ChangeLogSection";
import { SURVEILLANCE_POLL_INTERVAL_MS } from "@/config/surveillance";
import { Panel } from "@/components/layout/Panel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const ZONE_LABELS: Record<ActionabilityZone, string> = {
  act_now: "Act now zone",
  too_early: "Too early zone",
  crowded: "Crowded zone",
};

function StepIcon({ step }: { step: SurveillanceStep }) {
  if (step.icon === "scanning") {
    return <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-brand-amber" />;
  }
  if (step.icon === "relevant") {
    return <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1D9E75]" />;
  }
  if (step.icon === "filtered") {
    return (
      <X
        className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-40"
        style={{ color: "var(--color-text-tertiary)" }}
      />
    );
  }
  return (
    <Minus
      className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-40"
      style={{ color: "var(--color-text-tertiary)" }}
    />
  );
}

interface SurveillancePanelProps {
  status: OpportunityStatus;
  actionabilityZone: ActionabilityZone;
  lastCheckedAt: string | null;
  steps: SurveillanceStep[];
  summary: SurveillanceScanSummary | null;
  isScanning: boolean;
  countdown: number;
  changeLog?: ChangeLogEntry[];
  scrollClassName?: string;
  onResume?: () => void;
  resuming?: boolean;
}

export function SurveillancePanel({
  status,
  actionabilityZone,
  lastCheckedAt,
  steps,
  summary,
  isScanning,
  countdown,
  changeLog = [],
  scrollClassName,
  onResume,
  resuming,
}: SurveillancePanelProps) {
  const isPaused = status === "paused";
  const pollSeconds = Math.floor(SURVEILLANCE_POLL_INTERVAL_MS / 1000);
  const displaySteps = [...steps].reverse();

  const statusPill = isPaused ? (
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
      Paused
    </span>
  ) : isScanning ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-amber/15 px-2 py-0.5 text-[10px] font-medium text-brand-amber animate-pulse">
      Scanning now
    </span>
  ) : (
    <span className="rounded-full bg-[#E1F5EE] px-2 py-0.5 text-[10px] font-medium text-[#085041]">
      Watching
    </span>
  );

  const lastScanLabel = formatLastChecked(lastCheckedAt).replace(
    "Last checked:",
    "Last scan:"
  );

  return (
    <Panel
      title="Surveillance"
      description={lastScanLabel}
      action={statusPill}
      noPadding
      bodyClassName="p-0"
    >
      {isPaused && (
        <div
          className="mx-4 mt-4 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-xs"
          style={{ background: "#FAEEDA", color: "#633806" }}
        >
          <span>Surveillance paused ·</span>
          <button
            type="button"
            onClick={onResume}
            disabled={resuming}
            className="font-medium underline underline-offset-2 hover:no-underline"
          >
            {resuming ? "Resuming…" : "Resume"}
          </button>
          <span>to continue watching</span>
        </div>
      )}

      <ScrollArea className={cn(scrollClassName ?? "h-[min(420px,calc(100vh-22rem))]")}>
        <div className="space-y-4 p-4">
          {changeLog.length > 0 && (
            <ChangeLogSection entries={changeLog} variant="inline" />
          )}

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Live scan
            </p>
            <div
              className="overflow-hidden rounded-xl border"
              style={{
                background: "var(--color-background-primary)",
                borderColor: "var(--color-border-tertiary)",
                borderWidth: 0.5,
              }}
            >
              {displaySteps.length === 0 && !isScanning && (
                <p
                  className="px-4 py-6 text-center text-xs"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  {isPaused
                    ? "Surveillance is paused."
                    : "Waiting for next scan…"}
                </p>
              )}

              {displaySteps.map((step, index) => (
                <div
                  key={step.id}
                  className={cn(
                    "flex items-start gap-2.5 px-4 py-2",
                    index < displaySteps.length - 1 && "border-b"
                  )}
                  style={{
                    borderColor: "var(--color-border-tertiary)",
                    borderBottomWidth: 0.5,
                  }}
                >
                  <StepIcon step={step} />
                  <p
                    className={cn(
                      "text-xs leading-relaxed",
                      step.positive && "text-[#1D9E75]",
                      step.muted && !step.positive && "text-[var(--color-text-tertiary)]",
                      !step.muted && !step.positive && "text-[var(--color-text-primary)]"
                    )}
                  >
                    {step.description}
                  </p>
                </div>
              ))}

              {summary && (
                <div
                  className="border-t px-4 py-3 text-xs"
                  style={{
                    borderColor: "var(--color-border-tertiary)",
                    color: summary.positive ? "#1D9E75" : "var(--color-text-tertiary)",
                  }}
                >
                  {summary.message}
                  {summary.positive && summary.newCardIds.length > 0 && (
                    <span className="ml-2">
                      {summary.newCardIds.map((cardId, i) => (
                        <span key={cardId}>
                          {i > 0 && " · "}
                          <Link
                            href={`#card-${cardId}`}
                            className="underline underline-offset-2"
                          >
                            View card
                          </Link>
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {!isPaused && (
            <p
              className="text-[11px]"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              Scanning every {pollSeconds}s · {ZONE_LABELS[actionabilityZone]} · Next
              scan in {isScanning ? "…" : `${countdown}s`}
            </p>
          )}
        </div>
      </ScrollArea>
    </Panel>
  );
}

export function SurveillancePauseButton({
  status,
  pausing,
  resuming,
  onPause,
  onResume,
}: {
  status: OpportunityStatus;
  pausing: boolean;
  resuming: boolean;
  onPause: () => void;
  onResume: () => void;
}) {
  const canPauseSurveillance =
    status === "surveillance" || status === "complete";

  if (status === "paused") {
    return (
      <button
        type="button"
        onClick={onResume}
        disabled={resuming}
        className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium text-[#1D9E75] transition-colors hover:bg-[#E1F5EE] disabled:opacity-50"
        style={{ borderColor: "#1D9E75" }}
      >
        <Play className="h-3.5 w-3.5" />
        {resuming ? "Resuming…" : "Resume surveillance"}
      </button>
    );
  }

  if (!canPauseSurveillance) return null;

  return (
    <button
      type="button"
      onClick={onPause}
      disabled={pausing}
      className="inline-flex items-center gap-1.5 rounded-md border bg-transparent px-2.5 py-1 text-xs font-medium transition-colors hover:bg-[var(--color-background-secondary)] disabled:opacity-50"
      style={{
        color: "var(--color-text-secondary)",
        borderColor: "var(--color-border-tertiary)",
      }}
    >
      <Pause className="h-3.5 w-3.5" />
      {pausing ? "Pausing…" : "Pause surveillance"}
    </button>
  );
}
