"use client";

import type { IndRegulatoryPackageV3 } from "@/types/V3Pipeline";
import { normalizeBiomarkerItems } from "@/lib/formatBiomarker";
import { V3Panel } from "@/components/opportunity/v3/V3Panel";
import { cn } from "@/lib/utils";

interface IndPackagePanelProps {
  package_: IndRegulatoryPackageV3 | null | undefined;
  className?: string;
}

function SectionList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p
        className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: "var(--v3-teal)" }}
      >
        {title}
      </p>
      <ul className="mt-2 space-y-1">
        {items.map((item) => (
          <li
            key={item}
            className="text-sm leading-relaxed"
            style={{ color: "var(--color-text-secondary)" }}
          >
            <span className="mr-1.5" style={{ color: "var(--v3-amber)" }}>
              ▸
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function IndPackagePanel({ package_, className }: IndPackagePanelProps) {
  if (!package_) {
    return (
      <V3Panel title="IND package" description="Regulatory assembly roadmap" className={className}>
        <p className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>
          IND package assembly runs after TPP and risk scoring
        </p>
      </V3Panel>
    );
  }

  const cdp = package_.clinical_development_plan;

  return (
    <V3Panel
      title="IND package"
      description={`Target agency: ${package_.target_agency}`}
      className={className}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <SectionList title="Preclinical roadmap" items={package_.preclinical_roadmap} />
        <SectionList title="CMC requirements" items={package_.cmc_requirements} />
        <SectionList title="Tox studies" items={package_.tox_studies} />
        <div>
          <p
            className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: "var(--v3-teal)" }}
          >
            Clinical development
          </p>
          <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
            {cdp.trial_type} · n={cdp.sample_size}
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--color-text-secondary)" }}>
            {cdp.design}
          </p>
          <p className="mt-2 text-xs">
            <span style={{ color: "var(--color-text-tertiary)" }}>Primary endpoint: </span>
            <span style={{ color: "var(--v3-navy)" }}>{cdp.primary_endpoint}</span>
          </p>
        </div>
      </div>
      {package_.assembly_notes && (
        <p
          className={cn("mt-4 rounded-lg border px-3 py-2 text-xs leading-relaxed")}
          style={{
            borderColor: "rgba(196, 132, 45, 0.2)",
            background: "var(--v3-amber-glow)",
            color: "var(--color-text-secondary)",
          }}
        >
          {package_.assembly_notes}
        </p>
      )}
      {cdp.biomarkers && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          <BiomarkerGroup label="Predictive" items={normalizeBiomarkerItems(cdp.biomarkers.predictive)} />
          <BiomarkerGroup label="Surrogate" items={normalizeBiomarkerItems(cdp.biomarkers.surrogate)} />
          <BiomarkerGroup label="PD" items={normalizeBiomarkerItems(cdp.biomarkers.target_engagement_pd)} />
          <BiomarkerGroup label="Safety" items={normalizeBiomarkerItems(cdp.biomarkers.safety)} />
        </div>
      )}
    </V3Panel>
  );
}

function BiomarkerGroup({ label, items }: { label: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <p
        className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: "var(--v3-teal)" }}
      >
        {label}
      </p>
      <ul className="mt-1 space-y-0.5">
        {items.map((item) => (
          <li key={item} style={{ color: "var(--color-text-secondary)" }}>
            · {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
