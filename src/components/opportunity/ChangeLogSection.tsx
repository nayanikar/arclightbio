"use client";

import type { ChangeLogEntry } from "@/types/OpportunityObject";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

interface ChangeLogSectionProps {
  entries: ChangeLogEntry[];
  variant?: "collapsible" | "inline";
}

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ChangeLogList({ entries }: { entries: ChangeLogEntry[] }) {
  return (
    <div className="space-y-2">
      {[...entries].reverse().map((entry, index) => (
        <div
          key={`${entry.timestamp}-${entry.trigger}-${index}`}
          className="rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-teal">
              {entry.trigger.replace(/_/g, " ")}
            </span>
            <time className="text-[11px] text-gray-400">
              {formatTimestamp(entry.timestamp)}
            </time>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-gray-700">
            {entry.summary}
          </p>
          {entry.agents_reinitiated.length > 0 && (
            <p className="mt-1.5 text-[11px] text-gray-400">
              Agents: {entry.agents_reinitiated.join(", ")}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export function ChangeLogSection({
  entries,
  variant = "collapsible",
}: ChangeLogSectionProps) {
  const [open, setOpen] = useState(entries.length > 0);

  if (entries.length === 0) return null;

  if (variant === "inline") {
    return (
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          Change log
        </p>
        <ChangeLogList entries={entries} />
      </div>
    );
  }

  return (
    <div className="border-t border-gray-100">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-gray-50"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Change log
        </span>
        <span className="flex items-center gap-2 text-[11px] text-gray-400">
          {entries.length} event{entries.length === 1 ? "" : "s"}
          {open ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </span>
      </button>

      {open && (
        <div className="space-y-2 px-4 pb-4">
          <ChangeLogList entries={entries} />
        </div>
      )}
    </div>
  );
}

export function formatLastChecked(lastCheckedAt: string | null): string {
  if (!lastCheckedAt) return "Not checked yet";

  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(lastCheckedAt).getTime()) / 60_000)
  );

  if (minutes < 1) return "Last checked: just now";
  if (minutes === 1) return "Last checked: 1 minute ago";
  return `Last checked: ${minutes} minutes ago`;
}
