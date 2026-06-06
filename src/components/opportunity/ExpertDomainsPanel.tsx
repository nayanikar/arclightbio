"use client";

import { useState } from "react";
import type { CD1Pattern, CD2Association, ExpertDomain } from "@/types/V3Pipeline";
import { V3Panel } from "@/components/opportunity/v3/V3Panel";
import { cn } from "@/lib/utils";

interface ExpertDomainsPanelProps {
  expertDomains?: ExpertDomain[] | null;
  cd1Patterns?: CD1Pattern[] | null;
  cd2Associations?: CD2Association[] | null;
  className?: string;
}

type TabKey = "cd1" | "cd2";

const ASSOC_TYPE_LABEL: Record<string, string> = {
  disease: "Disease",
  organ: "Organ",
  molecular: "Molecular",
};

function PatternList({ patterns }: { patterns: CD1Pattern[] }) {
  if (patterns.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>
        No CD1 patterns yet
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {patterns.slice(0, 5).map((p, i) => (
        <li
          key={i}
          className="rounded-lg border border-[rgba(15,26,46,0.08)] bg-white/60 px-4 py-3"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold" style={{ color: "var(--v3-navy)" }}>
              {p.domain}
            </span>
            <span className="font-mono text-[10px] tabular-nums" style={{ color: "var(--v3-amber)" }}>
              {(p.recurrence_rate * 100).toFixed(0)}% · n={p.patient_count}
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
            {p.pattern}
          </p>
        </li>
      ))}
    </ul>
  );
}

function AssociationList({ associations }: { associations: CD2Association[] }) {
  if (associations.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>
        No CD2 associations yet
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {associations.slice(0, 5).map((a, i) => (
        <li
          key={i}
          className="rounded-lg border border-[rgba(15,26,46,0.08)] bg-white/60 px-4 py-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold" style={{ color: "var(--v3-navy)" }}>
              {a.domain}
            </span>
            {a.association_type && (
              <span
                className="rounded px-1.5 py-0.5 text-[10px] uppercase"
                style={{
                  background: "var(--v3-amber-glow)",
                  color: "var(--v3-amber)",
                }}
              >
                {ASSOC_TYPE_LABEL[a.association_type] ?? a.association_type}
              </span>
            )}
            <span className="ml-auto font-mono text-[10px] tabular-nums text-[var(--v3-teal)]">
              {(a.confidence * 100).toFixed(0)}%
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
            {a.association_claim}
          </p>
        </li>
      ))}
    </ul>
  );
}

function expertToCd1(domains: ExpertDomain[]): CD1Pattern[] {
  return domains.map((d) => ({
    domain: d.domain,
    pattern: d.description ?? d.domain,
    recurrence_rate: d.biology_recurrence_rate ?? d.recurrence_score ?? 0,
    patient_count: 0,
    co_occurring_features: [],
    parent_domain: "",
  }));
}

function expertToCd2(domains: ExpertDomain[]): CD2Association[] {
  return domains.map((d) => ({
    domain: d.domain,
    association_type: d.association_types?.[0] ?? "disease",
    association_claim: d.description ?? d.domain,
    evidence_sources: [],
    confidence: d.recurrence_score ?? 0.5,
  }));
}

export function ExpertDomainsPanel({
  expertDomains,
  cd1Patterns,
  cd2Associations,
  className,
}: ExpertDomainsPanelProps) {
  const [tab, setTab] = useState<TabKey>("cd1");

  const resolvedCd1 =
    cd1Patterns ??
    expertToCd1(expertDomains?.filter((d) => d.source === "cd1") ?? []);

  const resolvedCd2 =
    cd2Associations ??
    expertToCd2(expertDomains?.filter((d) => d.source === "cd2") ?? []);

  return (
    <V3Panel
      title="Expert domains"
      description="CD1 cohort patterns · CD2 literature associations"
      className={className}
    >
      <div className="mb-4 flex gap-1 rounded-lg border p-1" style={{ borderColor: "rgba(15,26,46,0.08)" }}>
        {(
          [
            { key: "cd1" as const, label: "CD1 patterns" },
            { key: "cd2" as const, label: "CD2 literature" },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors",
              tab === key ? "text-white shadow-sm" : "hover:bg-black/[0.03]"
            )}
            style={
              tab === key
                ? { background: key === "cd1" ? "var(--v3-teal)" : "var(--v3-amber)" }
                : { color: "var(--color-text-secondary)" }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "cd1" ? <PatternList patterns={resolvedCd1} /> : <AssociationList associations={resolvedCd2} />}
    </V3Panel>
  );
}
