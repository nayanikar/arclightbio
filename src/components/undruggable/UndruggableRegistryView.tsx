"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, ShieldOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { V3InfoCallout } from "@/components/opportunity/v3/V3Typography";
import { UndruggableTargetCard } from "@/components/undruggable/UndruggableTargetCard";
import {
  computeUndruggableStats,
  filterUndruggableRecords,
  groupUndruggableByTarget,
  type UndruggableRegistryStats,
  type UndruggableScopeFilter,
} from "@/lib/undruggableRegistry";
import type { UndruggableTargetRecord } from "@/types/V3Pipeline";
import { cn } from "@/lib/utils";

const SCOPE_OPTIONS: Array<{ id: UndruggableScopeFilter; label: string }> = [
  { id: "all", label: "All entries" },
  { id: "global", label: "Global only" },
  { id: "session", label: "Session-linked" },
  { id: "rescan", label: "Rescan eligible" },
];

function MetricTile({
  label,
  value,
  accent = "default",
  delay = 0,
}: {
  label: string;
  value: number | string;
  accent?: "default" | "teal" | "amber";
  delay?: number;
}) {
  const color = {
    default: "var(--v3-navy)",
    teal: "var(--v3-teal)",
    amber: "var(--v3-amber)",
  }[accent];

  return (
    <div
      className="undruggable-metric flex min-w-0 flex-col justify-center px-4 py-3"
      style={{ animationDelay: `${delay}ms` }}
    >
      <p
        className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em]"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        {label}
      </p>
      <p
        className="font-display text-[26px] font-medium tabular-nums leading-none"
        style={{ color }}
      >
        {value}
      </p>
    </div>
  );
}

export function UndruggableRegistryView() {
  const [targets, setTargets] = useState<UndruggableTargetRecord[]>([]);
  const [stats, setStats] = useState<UndruggableRegistryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<UndruggableScopeFilter>("all");

  useEffect(() => {
    fetch("/api/undruggable", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load registry (${r.status})`);
        return r.json();
      })
      .then((data) => {
        const list = data.targets ?? [];
        setTargets(list);
        setStats(data.stats ?? computeUndruggableStats(list));
      })
      .catch(() => setError("Could not load undruggable registry."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () => filterUndruggableRecords(targets, query, scope),
    [targets, query, scope]
  );

  const groups = useMemo(() => groupUndruggableByTarget(filtered), [filtered]);
  const displayStats = stats ?? computeUndruggableStats(targets);

  return (
    <div className="space-y-6">
      <section
        className="undruggable-hero relative overflow-hidden rounded-xl border px-6 py-7"
        style={{
          borderColor: "rgba(15, 26, 46, 0.1)",
          background:
            "linear-gradient(135deg, var(--v3-navy) 0%, var(--v3-navy-muted) 52%, rgba(196,132,45,0.18) 100%)",
        }}
      >
        <div className="v3-accent-rule absolute inset-x-0 top-0 opacity-90" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p
              className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em]"
              style={{ color: "var(--v3-amber)" }}
            >
              Cross-session learning
            </p>
            <h2
              className="mt-2 font-display text-2xl font-semibold leading-snug text-balance sm:text-[1.65rem]"
              style={{ color: "#f8f5ef" }}
            >
              Targets where direct modulation is not pursued
            </h2>
            <p
              className="mt-3 text-sm leading-relaxed"
              style={{ color: "rgba(248,245,239,0.68)" }}
            >
              Arclight records targets that fail three-modality druggability screening.
              Future discovery programs inherit this registry automatically — avoiding
              repeated dead-end routes. Rescan-eligible entries may be reconsidered on
              a manual target re-screen; automatic literature monitoring is not active yet.
            </p>
          </div>
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border"
            style={{
              borderColor: "rgba(248,245,239,0.15)",
              background: "rgba(248,245,239,0.06)",
            }}
          >
            <ShieldOff className="h-7 w-7" style={{ color: "var(--v3-amber)" }} />
          </div>
        </div>
      </section>

      <div
        className="dashboard-summary overflow-clip rounded-xl border grid grid-cols-2 divide-x divide-y sm:grid-cols-4 sm:divide-y-0"
        style={{
          borderColor: "rgba(15, 26, 46, 0.1)",
          background: "var(--v3-paper)",
          borderWidth: 0.5,
        }}
      >
        <MetricTile label="Registry entries" value={displayStats.total} delay={0} />
        <MetricTile
          label="Unique targets"
          value={displayStats.uniqueTargets}
          accent="teal"
          delay={40}
        />
        <MetricTile
          label="Global blocks"
          value={displayStats.globalCount}
          accent="amber"
          delay={80}
        />
        <MetricTile
          label="Rescan eligible"
          value={displayStats.rescanEligible}
          delay={120}
        />
      </div>

      <V3InfoCallout title="How the registry is used">
        During Phase 2 target screening, entries here pre-block targets before
        expensive drug-branch steps run. Session assessments are promoted into this
        list when a primary target fails across small molecule, biologic, and ADC
        modalities. Global entries apply to all future discoveries.
      </V3InfoCallout>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: "var(--color-text-tertiary)" }}
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search target, reasoning, or alternate route…"
            className="h-11 border-[var(--color-border-tertiary)] bg-white/80 pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {SCOPE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setScope(opt.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide transition-colors",
                scope === opt.id
                  ? "ring-1"
                  : "hover:border-[var(--v3-teal)]/30"
              )}
              style={{
                borderColor:
                  scope === opt.id
                    ? "rgba(26, 107, 99, 0.35)"
                    : "rgba(15, 26, 46, 0.12)",
                background:
                  scope === opt.id
                    ? "rgba(26, 107, 99, 0.1)"
                    : "transparent",
                color:
                  scope === opt.id ? "var(--v3-teal)" : "var(--color-text-tertiary)",
                ...(scope === opt.id
                  ? { boxShadow: "0 0 0 1px rgba(26, 107, 99, 0.15)" }
                  : {}),
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div
          className="dashboard-queue rounded-xl border px-6 py-16 text-center"
          style={{ borderColor: "rgba(15, 26, 46, 0.1)" }}
        >
          <p className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>
            Loading registry…
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {!loading && !error && groups.length === 0 && (
        <div
          className="dashboard-queue rounded-xl border border-dashed px-8 py-14 text-center"
          style={{ borderColor: "rgba(15, 26, 46, 0.15)" }}
        >
          <p className="font-display text-lg font-semibold" style={{ color: "var(--v3-navy)" }}>
            No registry entries match
          </p>
          <p className="mt-2 text-sm" style={{ color: "var(--color-text-tertiary)" }}>
            {targets.length === 0
              ? "Undruggable targets will appear here after target screening completes."
              : "Try clearing filters or broadening your search."}
          </p>
        </div>
      )}

      {!loading && !error && groups.length > 0 && (
        <div className="space-y-8">
          {groups.map((group, groupIndex) => (
            <section
              key={group.targetName}
              className="undruggable-group"
              style={{ animationDelay: `${groupIndex * 60}ms` }}
            >
              <div className="mb-4 flex flex-wrap items-baseline gap-3">
                <h3
                  className="font-display text-xl font-semibold"
                  style={{ color: "var(--v3-navy)" }}
                >
                  {group.targetName}
                </h3>
                <span
                  className="font-mono text-[10px] uppercase tracking-[0.14em]"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  {group.entries.length} assessment
                  {group.entries.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="space-y-3">
                {group.entries.map((entry) => (
                  <UndruggableTargetCard
                    key={entry.id}
                    entry={entry}
                    showTargetName={group.entries.length > 1}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
