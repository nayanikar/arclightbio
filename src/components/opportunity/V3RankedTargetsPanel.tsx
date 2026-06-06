"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { FalsificationExperiment, RankedTarget } from "@/types/V3Pipeline";
import { V3Panel } from "@/components/opportunity/v3/V3Panel";
import { V3StructuredProse } from "@/components/opportunity/v3/V3StructuredProse";

interface V3RankedTargetsPanelProps {
  targets: RankedTarget[] | null | undefined;
  falsification?: FalsificationExperiment | null;
  className?: string;
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div>
      <div className="flex justify-between text-[10px]">
        <span style={{ color: "var(--color-text-tertiary)" }}>{label}</span>
        <span className="font-mono tabular-nums" style={{ color: "var(--v3-navy)" }}>
          {pct}%
        </span>
      </div>
      <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-[rgba(15,26,46,0.06)]">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: "var(--v3-teal)" }}
        />
      </div>
    </div>
  );
}

function TargetRow({ target }: { target: RankedTarget }) {
  const [expanded, setExpanded] = useState(false);
  const label = target.gene_symbol ?? target.target_name;

  return (
    <div className="rounded-lg border border-[rgba(15,26,46,0.08)] bg-white/60">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        <span
          className="font-mono text-xs font-bold tabular-nums"
          style={{ color: "var(--v3-amber)" }}
        >
          #{target.rank}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium" style={{ color: "var(--v3-navy)" }}>
            {label}
          </p>
          <div className="mt-1 line-clamp-3 text-xs">
            <V3StructuredProse content={target.rationale} />
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0" style={{ color: "var(--v3-teal)" }} />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0" style={{ color: "var(--v3-teal)" }} />
        )}
      </button>
      {expanded && (
        <div className="space-y-2 border-t border-[rgba(15,26,46,0.06)] px-4 py-3">
          <ScoreBar label="Association" value={target.association_strength ?? 0} />
          <ScoreBar label="Causation" value={target.causation_strength ?? 0} />
          <ScoreBar label="Selectivity feasibility" value={target.selectivity_feasibility ?? 0} />
        </div>
      )}
    </div>
  );
}

function FalsificationBlock({ exp }: { exp: FalsificationExperiment }) {
  return (
    <div
      className="mt-4 rounded-lg border px-4 py-3"
      style={{
        borderColor: "rgba(196, 132, 45, 0.3)",
        background: "linear-gradient(135deg, var(--v3-amber-glow) 0%, transparent 100%)",
      }}
    >
      <p
        className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em]"
        style={{ color: "var(--v3-amber)" }}
      >
        Falsification experiment
      </p>
      <p className="mt-2 text-sm font-medium" style={{ color: "var(--v3-navy)" }}>
        {exp.objective}
      </p>
      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <div>
          <dt style={{ color: "var(--color-text-tertiary)" }}>Design</dt>
          <dd className="mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
            {exp.design}
          </dd>
        </div>
        <div>
          <dt style={{ color: "var(--color-text-tertiary)" }}>Primary readout</dt>
          <dd className="mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
            {exp.primary_readout}
          </dd>
        </div>
        <div>
          <dt style={{ color: "var(--color-text-tertiary)" }}>Failure criteria</dt>
          <dd className="mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
            {exp.failure_criteria}
          </dd>
        </div>
        <div>
          <dt style={{ color: "var(--color-text-tertiary)" }}>Timeline · cost</dt>
          <dd className="mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
            {exp.estimated_timeline}
            {exp.estimated_cost_range ? ` · ${exp.estimated_cost_range}` : ""}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function V3RankedTargetsPanel({
  targets,
  falsification,
  className,
}: V3RankedTargetsPanelProps) {
  if (!targets?.length) {
    return (
      <V3Panel title="Ranked targets" description="Selectivity-ranked with falsification design" className={className}>
        <p className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>
          Target ranking populates after selectivity filter
        </p>
      </V3Panel>
    );
  }

  return (
    <V3Panel
      title="Ranked targets"
      description={`${targets.length} targets · association → causation → selectivity`}
      className={className}
    >
      <div className="space-y-2">
        {targets.map((t) => (
          <TargetRow key={t.rank} target={t} />
        ))}
      </div>
      {falsification && <FalsificationBlock exp={falsification} />}
    </V3Panel>
  );
}
