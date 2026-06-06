"use client";

import type { TargetFamilyContext } from "@/types/V3Pipeline";
import { V3Panel } from "@/components/opportunity/v3/V3Panel";

interface TargetFamilyPanelProps {
  context: TargetFamilyContext | null | undefined;
  className?: string;
}

export function TargetFamilyPanel({ context, className }: TargetFamilyPanelProps) {
  if (!context) {
    return (
      <V3Panel title="Target family" description="Structural class and pathway context" className={className}>
        <p className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>
          Target family context populates after selectivity ranking
        </p>
      </V3Panel>
    );
  }

  return (
    <V3Panel
      title="Target family"
      description={`${context.family_taxonomy} · ${context.target_name}`}
      className={className}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <dl className="space-y-3 text-xs">
          <div>
            <dt style={{ color: "var(--color-text-tertiary)" }}>Structural class</dt>
            <dd className="mt-0.5 font-medium" style={{ color: "var(--v3-navy)" }}>
              {context.structural_class || "—"}
            </dd>
          </div>
          <div>
            <dt style={{ color: "var(--color-text-tertiary)" }}>Subcellular location</dt>
            <dd className="mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
              {context.subcellular_location || "—"}
            </dd>
          </div>
          <div>
            <dt style={{ color: "var(--color-text-tertiary)" }}>Activation mechanism</dt>
            <dd className="mt-0.5 leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
              {context.activation_mechanism || "—"}
            </dd>
          </div>
        </dl>
        <div>
          <p
            className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em]"
            style={{ color: "var(--v3-teal)" }}
          >
            Pathway networks
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {(context.pathway_networks ?? []).map((p) => (
              <li
                key={p}
                className="rounded-md border px-2 py-1 text-[11px]"
                style={{
                  borderColor: "rgba(26, 107, 99, 0.2)",
                  color: "var(--v3-teal)",
                  background: "rgba(26, 107, 99, 0.06)",
                }}
              >
                {p}
              </li>
            ))}
          </ul>
          {(() => {
            const refCount = context.references?.length ?? 0;
            if (refCount === 0) return null;
            return (
              <p className="mt-3 text-[10px]" style={{ color: "var(--color-text-tertiary)" }}>
                {refCount} reference{refCount === 1 ? "" : "s"} cited
              </p>
            );
          })()}
        </div>
      </div>
    </V3Panel>
  );
}
