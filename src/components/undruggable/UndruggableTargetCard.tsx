"use client";

import Link from "next/link";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { V3StructuredProse } from "@/components/opportunity/v3/V3StructuredProse";
import { formatModalitySummary } from "@/lib/undruggableRegistry";
import type { UndruggableTargetRecord } from "@/types/V3Pipeline";
import { cn } from "@/lib/utils";

interface UndruggableTargetCardProps {
  entry: UndruggableTargetRecord;
  showTargetName?: boolean;
  className?: string;
}

function sessionShortId(id: string): string {
  return id.slice(-8);
}

function formatRecordedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function UndruggableTargetCard({
  entry,
  showTargetName = true,
  className,
}: UndruggableTargetCardProps) {
  const isGlobal = !entry.opportunity_object_id;
  const modalities = formatModalitySummary(entry.intervention_point);

  return (
    <article
      className={cn(
        "undruggable-entry relative overflow-hidden rounded-lg border px-4 py-4 sm:px-5 sm:py-5",
        className
      )}
      style={{
        borderColor: isGlobal
          ? "rgba(196, 132, 45, 0.28)"
          : "rgba(15, 26, 46, 0.1)",
        background: isGlobal
          ? "linear-gradient(135deg, rgba(248,245,239,0.95) 0%, rgba(196,132,45,0.06) 100%)"
          : "rgba(255,255,255,0.82)",
      }}
    >
      <div
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{
          background: isGlobal ? "var(--v3-amber)" : "var(--v3-teal)",
        }}
      />

      <div className="flex flex-wrap items-start justify-between gap-3 pl-2">
        <div className="min-w-0 flex-1">
          {showTargetName && (
            <h3
              className="font-display text-base font-semibold leading-snug"
              style={{ color: "var(--v3-navy)" }}
            >
              {entry.target_name}
            </h3>
          )}
          <p
            className={cn(
              "font-mono text-[10px] uppercase tracking-[0.14em]",
              showTargetName ? "mt-1.5" : ""
            )}
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {modalities}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className="rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide"
            style={{
              borderColor: isGlobal
                ? "rgba(196, 132, 45, 0.35)"
                : "rgba(26, 107, 99, 0.25)",
              background: isGlobal
                ? "rgba(196, 132, 45, 0.1)"
                : "rgba(26, 107, 99, 0.08)",
              color: isGlobal ? "var(--v3-amber)" : "var(--v3-teal)",
            }}
          >
            {isGlobal ? "Global registry" : "Session"}
          </span>
          {entry.rescan_eligible !== false && (
            <span
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide"
              style={{
                borderColor: "rgba(15, 26, 46, 0.12)",
                color: "var(--color-text-tertiary)",
              }}
              title="Eligible for periodic re-scan as modality science evolves"
            >
              <RefreshCw className="h-3 w-3" />
              Rescan
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 pl-2">
        <V3StructuredProse content={entry.reasoning} />
      </div>

      {entry.alternate_intervention && (
        <div
          className="mt-4 border-l-2 pl-3 pl-2"
          style={{ borderColor: "rgba(26, 107, 99, 0.25)" }}
        >
          <p
            className="font-mono text-[10px] uppercase tracking-[0.12em]"
            style={{ color: "var(--v3-teal)" }}
          >
            Alternate intervention
          </p>
          <p
            className="mt-1 text-sm leading-relaxed"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {entry.alternate_intervention}
          </p>
        </div>
      )}

      <footer
        className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3 pl-2"
        style={{ borderColor: "rgba(15, 26, 46, 0.08)" }}
      >
        <time
          className="font-mono text-[10px] uppercase tracking-wide"
          style={{ color: "var(--color-text-tertiary)" }}
          dateTime={entry.created_at}
        >
          Recorded {formatRecordedAt(entry.created_at)}
        </time>
        {entry.opportunity_object_id && (
          <Link
            href={`/opportunity/${entry.opportunity_object_id}`}
            className="inline-flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-80"
            style={{ color: "var(--v3-teal)" }}
          >
            Program …{sessionShortId(entry.opportunity_object_id)}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </footer>
    </article>
  );
}
