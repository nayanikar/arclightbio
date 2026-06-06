"use client";

import type { AnchorProfile, AnchorProfiles } from "@/types/V3Pipeline";
import { shortenForField, shortenForSupporting } from "@/lib/compressProse";
import { formatMarketSizeUsdB, parseMarketSizeUsdB } from "@/lib/parseMarketSize";
import { V3Panel } from "@/components/opportunity/v3/V3Panel";
import { V3StructuredProse } from "@/components/opportunity/v3/V3StructuredProse";

interface AnchorProfilesPanelProps {
  profiles: AnchorProfiles | null | undefined;
  className?: string;
}

function resolveMarketDisplay(profile: AnchorProfile): {
  primary: string;
  secondary: string | null;
} {
  if (profile.market_size_usd_b != null) {
    return {
      primary: formatMarketSizeUsdB(profile.market_size_usd_b),
      secondary: profile.market_size_rationale ?? profile.market_size ?? null,
    };
  }
  const parsed = parseMarketSizeUsdB(profile.market_size);
  if (parsed != null) {
    return {
      primary: formatMarketSizeUsdB(parsed),
      secondary: profile.market_size_rationale ?? profile.market_size ?? null,
    };
  }
  if (profile.market_size_rationale) {
    return { primary: profile.market_size_rationale, secondary: null };
  }
  if (profile.market_size) {
    return { primary: profile.market_size, secondary: null };
  }
  return { primary: "—", secondary: null };
}

function AnchorCard({
  label,
  profile,
  accent,
}: {
  label: string;
  profile: AnchorProfiles["biology"];
  accent: "biology" | "resistance";
}) {
  const borderColor =
    accent === "biology" ? "rgba(26, 107, 99, 0.25)" : "rgba(196, 132, 45, 0.3)";
  const market = resolveMarketDisplay(profile);

  return (
    <article
      className="rounded-lg border bg-white/70 p-5"
      style={{ borderColor }}
    >
      <p
        className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em]"
        style={{ color: accent === "biology" ? "var(--v3-teal)" : "var(--v3-amber)" }}
      >
        {label}
      </p>
      <p
        className="mt-3 font-display text-sm font-semibold leading-relaxed"
        style={{ color: "var(--v3-navy)" }}
      >
        {profile.anchor_statement || "Pending anchor extraction"}
      </p>
      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt
            className="font-mono text-[10px] uppercase tracking-wider"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Population
          </dt>
          <dd className="mt-1.5 leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
            {profile.population ? shortenForField(profile.population) : "—"}
          </dd>
        </div>
        <div>
          <dt
            className="font-mono text-[10px] uppercase tracking-wider"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Market size
          </dt>
          <dd className="mt-1.5 font-medium tabular-nums" style={{ color: "var(--v3-navy)" }}>
            {market.primary}
          </dd>
          {market.secondary && market.secondary !== market.primary && (
            <dd className="mt-1 text-xs leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
              {shortenForSupporting(market.secondary)}
            </dd>
          )}
        </div>
      </dl>
      {profile.rationale && (
        <div className="mt-4 border-t pt-4" style={{ borderColor: "rgba(15,26,46,0.08)" }}>
          <p
            className="font-mono text-[10px] uppercase tracking-wider"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Rationale
          </p>
          <div className="mt-1.5">
            <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
              {shortenForField(profile.rationale, 24)}
            </p>
          </div>
        </div>
      )}
    </article>
  );
}

export function AnchorProfilesPanel({ profiles, className }: AnchorProfilesPanelProps) {
  if (!profiles) {
    return (
      <V3Panel title="Anchor profiles" description="Biology + resistance + market size" className={className}>
        <p className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>
          Anchor extraction runs after cohort upload and population definition
        </p>
      </V3Panel>
    );
  }

  return (
    <V3Panel
      title="Anchor profiles"
      description="Biology + resistance anchors with market sizing"
      className={className}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <AnchorCard label="Biology anchor" profile={profiles.biology} accent="biology" />
        <AnchorCard label="Resistance anchor" profile={profiles.resistance} accent="resistance" />
      </div>
    </V3Panel>
  );
}
