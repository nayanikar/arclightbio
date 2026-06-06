"use client";

import { useMemo, useState } from "react";
import type {
  ClinicalDevelopmentPlan,
  IndRegulatoryPackageV3,
} from "@/types/V3Pipeline";
import { normalizeBiomarkerItems } from "@/lib/formatBiomarker";
import { formatIndBullets, isClamped, type IndBullet } from "@/lib/indPackageDisplay";
import { structureLongText } from "@/lib/structureProse";
import { V3Panel } from "@/components/opportunity/v3/V3Panel";
import { cn } from "@/lib/utils";
import {
  Beaker,
  Factory,
  FlaskConical,
  Stethoscope,
} from "lucide-react";

interface IndPackagePanelProps {
  package_: IndRegulatoryPackageV3 | null | undefined;
  className?: string;
}

type DevTab = "preclinical" | "cmc" | "tox";

const DEV_TABS: Array<{
  id: DevTab;
  label: string;
  icon: typeof FlaskConical;
  key: keyof Pick<IndRegulatoryPackageV3, "preclinical_roadmap" | "cmc_requirements" | "tox_studies">;
}> = [
  { id: "preclinical", label: "Preclinical", icon: FlaskConical, key: "preclinical_roadmap" },
  { id: "cmc", label: "CMC", icon: Factory, key: "cmc_requirements" },
  { id: "tox", label: "Toxicology", icon: Beaker, key: "tox_studies" },
];

function AgencyBadge({ agency }: { agency: IndRegulatoryPackageV3["target_agency"] }) {
  const label = agency === "both" ? "FDA · EMA" : agency;
  return (
    <span
      className="shrink-0 rounded-full border px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wide"
      style={{
        borderColor: "rgba(26, 107, 99, 0.25)",
        background: "rgba(26, 107, 99, 0.08)",
        color: "var(--v3-teal)",
      }}
    >
      {label}
    </span>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-lg border px-3 py-2.5"
      style={{
        borderColor: "rgba(15, 26, 46, 0.08)",
        background: "rgba(255,255,255,0.7)",
      }}
    >
      <p
        className="font-mono text-[9px] uppercase tracking-[0.12em]"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        {label}
      </p>
      <p
        className="mt-1 text-sm font-medium leading-snug"
        style={{ color: "var(--v3-navy)" }}
      >
        {value}
      </p>
    </div>
  );
}

function BulletList({
  items,
  emptyLabel = "No items recorded",
}: {
  items: IndBullet[];
  emptyLabel?: string;
}) {
  if (!items.length) {
    return (
      <p className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li
          key={`${i}-${item.display.slice(0, 24)}`}
          className="flex gap-2 text-sm leading-relaxed"
          style={{ color: "var(--color-text-secondary)" }}
          title={isClamped(item) ? item.full : undefined}
        >
          <span
            className="mt-2 h-1 w-1 shrink-0 rounded-full"
            style={{ background: "var(--v3-teal)" }}
          />
          <span>{item.display}</span>
        </li>
      ))}
    </ul>
  );
}

function ClinicalPlanCard({ plan }: { plan: ClinicalDevelopmentPlan }) {
  const secondary = plan.secondary_endpoints?.filter(Boolean) ?? [];
  const inclusion = plan.inclusion_criteria?.filter(Boolean) ?? [];
  const exclusion = plan.exclusion_criteria?.filter(Boolean) ?? [];

  return (
    <div
      className="rounded-lg border p-4 sm:p-5"
      style={{
        borderColor: "rgba(26, 107, 99, 0.2)",
        background:
          "linear-gradient(135deg, rgba(26,107,99,0.06) 0%, rgba(248,245,239,0.9) 100%)",
      }}
    >
      <div className="mb-4 flex items-center gap-2">
        <Stethoscope className="h-4 w-4 shrink-0" style={{ color: "var(--v3-teal)" }} />
        <p
          className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: "var(--v3-teal)" }}
        >
          Clinical development plan
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Trial" value={plan.trial_type || "—"} />
        <StatTile label="Enrollment" value={plan.sample_size ? `n=${plan.sample_size}` : "—"} />
        <StatTile
          label="Design"
          value={plan.design ? plan.design.split(/[.!?]/)[0]?.trim() || plan.design : "—"}
        />
        <StatTile
          label="Primary endpoint"
          value={plan.primary_endpoint ? plan.primary_endpoint.split(/[.!?]/)[0]?.trim() || plan.primary_endpoint : "—"}
        />
      </div>

      {(inclusion.length > 0 || exclusion.length > 0 || secondary.length > 0) && (
        <div className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-3" style={{ borderColor: "rgba(15,26,46,0.08)" }}>
          {inclusion.length > 0 && (
            <div>
              <p className="font-mono text-[9px] uppercase tracking-wide" style={{ color: "var(--color-text-tertiary)" }}>
                Inclusion
              </p>
              <BulletList items={formatIndBullets(inclusion, 16)} />
            </div>
          )}
          {exclusion.length > 0 && (
            <div>
              <p className="font-mono text-[9px] uppercase tracking-wide" style={{ color: "var(--color-text-tertiary)" }}>
                Exclusion
              </p>
              <BulletList items={formatIndBullets(exclusion, 16)} />
            </div>
          )}
          {secondary.length > 0 && (
            <div>
              <p className="font-mono text-[9px] uppercase tracking-wide" style={{ color: "var(--color-text-tertiary)" }}>
                Secondary endpoints
              </p>
              <BulletList items={formatIndBullets(secondary, 16)} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BiomarkerCard({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;

  return (
    <div
      className="rounded-lg border p-3"
      style={{
        borderColor: "rgba(15, 26, 46, 0.08)",
        background: "rgba(255,255,255,0.65)",
      }}
    >
      <p
        className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: "var(--v3-teal)" }}
      >
        {label}
      </p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li
            key={item}
            className="text-xs leading-relaxed"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function IndPackagePanel({ package_, className }: IndPackagePanelProps) {
  const [devTab, setDevTab] = useState<DevTab>("preclinical");

  const formattedLists = useMemo(() => {
    if (!package_) return null;
    return {
      preclinical_roadmap: formatIndBullets(package_.preclinical_roadmap),
      cmc_requirements: formatIndBullets(package_.cmc_requirements),
      tox_studies: formatIndBullets(package_.tox_studies),
    };
  }, [package_]);

  const assemblyStructured = useMemo(() => {
    if (!package_?.assembly_notes?.trim()) return null;
    return structureLongText(package_.assembly_notes);
  }, [package_?.assembly_notes]);

  if (!package_ || !formattedLists) {
    return (
      <V3Panel title="IND package" description="Regulatory assembly roadmap" className={className}>
        <p className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>
          IND package assembly runs after TPP and risk scoring
        </p>
      </V3Panel>
    );
  }

  const cdp = package_.clinical_development_plan;
  const activeTab = DEV_TABS.find((t) => t.id === devTab)!;
  const activeFormatted = formattedLists[activeTab.key];

  const biomarkers = cdp.biomarkers
    ? {
        predictive: normalizeBiomarkerItems(cdp.biomarkers.predictive),
        surrogate: normalizeBiomarkerItems(cdp.biomarkers.surrogate),
        pd: normalizeBiomarkerItems(cdp.biomarkers.target_engagement_pd),
        safety: normalizeBiomarkerItems(cdp.biomarkers.safety),
      }
    : null;

  const hasBiomarkers =
    biomarkers &&
    (biomarkers.predictive.length > 0 ||
      biomarkers.surrogate.length > 0 ||
      biomarkers.pd.length > 0 ||
      biomarkers.safety.length > 0);

  return (
    <V3Panel
      title="IND package"
      description="Regulatory development roadmap for filing"
      action={<AgencyBadge agency={package_.target_agency} />}
      className={className}
    >
      <div className="space-y-5">
        <ClinicalPlanCard plan={cdp} />

        <div>
          <p
            className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: "var(--v3-navy)" }}
          >
            Nonclinical &amp; CMC path
          </p>

          <div
            className="flex flex-wrap gap-1 rounded-lg border p-1"
            style={{
              borderColor: "rgba(15, 26, 46, 0.1)",
              background: "rgba(15, 26, 46, 0.03)",
            }}
            role="tablist"
            aria-label="Development path sections"
          >
            {DEV_TABS.map(({ id, label, icon: Icon, key }) => {
              const count = package_[key].length;
              const active = devTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setDevTab(id)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors sm:flex-none sm:justify-start",
                    active ? "shadow-sm" : "hover:bg-white/60"
                  )}
                  style={
                    active
                      ? {
                          background: "white",
                          color: "var(--v3-navy)",
                        }
                      : { color: "var(--color-text-tertiary)" }
                  }
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: active ? "var(--v3-teal)" : undefined }} />
                  {label}
                  <span
                    className="font-mono text-[10px] tabular-nums"
                    style={{ color: active ? "var(--v3-teal)" : "var(--color-text-tertiary)" }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div
            className="mt-2 max-h-56 overflow-y-auto rounded-lg border px-4 py-3"
            style={{
              borderColor: "rgba(15, 26, 46, 0.08)",
              background: "rgba(255,255,255,0.5)",
            }}
            role="tabpanel"
          >
            <BulletList items={activeFormatted} />
          </div>
        </div>

        {hasBiomarkers && biomarkers && (
          <div>
            <p
              className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: "var(--v3-navy)" }}
            >
              Biomarker strategy
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <BiomarkerCard label="Predictive" items={biomarkers.predictive} />
              <BiomarkerCard label="Surrogate" items={biomarkers.surrogate} />
              <BiomarkerCard label="Pharmacodynamic" items={biomarkers.pd} />
              <BiomarkerCard label="Safety" items={biomarkers.safety} />
            </div>
          </div>
        )}

        {assemblyStructured && assemblyStructured.summary && (
          <div
            className="rounded-lg border px-4 py-3"
            style={{
              borderColor: "rgba(196, 132, 45, 0.22)",
              background: "var(--v3-amber-glow)",
            }}
          >
            <p
              className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: "var(--v3-amber)" }}
            >
              Assembly summary
            </p>
            <p
              className="mt-2 text-sm font-medium leading-relaxed"
              style={{ color: "var(--v3-navy)" }}
            >
              {assemblyStructured.summary}
            </p>
            {assemblyStructured.key_points.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {assemblyStructured.key_points.map((point) => (
                  <li
                    key={point}
                    className="flex gap-2 text-xs leading-relaxed"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    <span style={{ color: "var(--v3-amber)" }}>▸</span>
                    {point}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </V3Panel>
  );
}
