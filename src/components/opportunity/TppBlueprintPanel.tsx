"use client";

import type { TppBlueprint } from "@/types/V3Pipeline";
import { normalizeBiomarkerItems } from "@/lib/formatBiomarker";
import { V3Panel } from "@/components/opportunity/v3/V3Panel";

interface TppBlueprintPanelProps {
  tpp: TppBlueprint | null | undefined;
  className?: string;
}

function TppField({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <p
        className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: "var(--v3-teal)" }}
      >
        {label}
      </p>
      <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
        {value}
      </p>
    </div>
  );
}

export function TppBlueprintPanel({ tpp, className }: TppBlueprintPanelProps) {
  if (!tpp) {
    return (
      <V3Panel title="TPP blueprint" description="Target product profile" className={className}>
        <p className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>
          TPP synthesis runs in Phase 2 after drug branch selection
        </p>
      </V3Panel>
    );
  }

  return (
    <V3Panel
      title="TPP blueprint"
      description="Falsifiable product claim anchored to mechanism"
      className={className}
      accent
    >
      <div className="space-y-4">
        <div
          className="rounded-lg border-l-4 px-4 py-3"
          style={{
            borderColor: "var(--v3-amber)",
            background: "var(--v3-amber-glow)",
          }}
        >
          <p className="font-display text-sm font-semibold leading-snug" style={{ color: "var(--v3-navy)" }}>
            {tpp.falsifiable_product_claim}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TppField label="Product characteristics" value={tpp.product_characteristics} />
          <TppField label="Tissue delivery" value={tpp.tissue_delivery} />
          <TppField label="Indication scope" value={tpp.indication_scope} />
          <TppField label="vs SOC" value={tpp.competitive_positioning_vs_soc} />
          <TppField label="Evidence plan" value={tpp.evidence_collection_plan} />
          <TppField label="First-in-class claim" value={tpp.first_in_class_mechanism_claim} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          <BiomarkerList label="Predictive" items={normalizeBiomarkerItems(tpp.biomarkers.predictive)} />
          <BiomarkerList label="Surrogate" items={normalizeBiomarkerItems(tpp.biomarkers.surrogate)} />
          <BiomarkerList label="PD" items={normalizeBiomarkerItems(tpp.biomarkers.target_engagement_pd)} />
          <BiomarkerList label="Safety" items={normalizeBiomarkerItems(tpp.biomarkers.safety)} />
        </div>
      </div>
    </V3Panel>
  );
}

function BiomarkerList({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p style={{ color: "var(--color-text-tertiary)" }}>{label}</p>
      <ul className="mt-1 space-y-0.5">
        {items.map((b) => (
          <li key={b} style={{ color: "var(--color-text-secondary)" }}>
            · {b}
          </li>
        ))}
      </ul>
    </div>
  );
}
