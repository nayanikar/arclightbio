import Link from "next/link";
import type { OpportunityObject } from "@/types/OpportunityObject";
import {
  formatUpdatedAgoShort,
  getRecentSurveillanceAgents,
  getUniqueAgents,
  truncate,
  zoneAccentColor,
} from "@/lib/dashboardLayout";
import { ZoneBadge } from "./ZoneBadge";
import { ConfidenceBar } from "./ConfidenceBar";
import { AgentPips } from "./AgentPips";
import { cn } from "@/lib/utils";

interface FeaturedOpportunityCardProps {
  opportunity: OpportunityObject;
  className?: string;
}

export function FeaturedOpportunityCard({
  opportunity,
  className,
}: FeaturedOpportunityCardProps) {
  const confidencePct = Math.round(opportunity.confidence_score * 100);
  const accentColor = zoneAccentColor(opportunity.actionability_zone);
  const evidenceCount = opportunity.evidence_cards.length;
  const challengeCount = opportunity.challenges.length;
  const agents = getUniqueAgents(opportunity.evidence_cards);
  const pulsingAgents = getRecentSurveillanceAgents(opportunity);

  return (
    <Link
      href={`/opportunity/${opportunity.id}`}
      className={cn(
        "block overflow-hidden rounded-xl border bg-white transition-shadow hover:shadow-md",
        className
      )}
      style={{ borderColor: "var(--color-border-tertiary)", borderWidth: 0.5 }}
    >
      <div className="h-[3px] w-full" style={{ background: accentColor }} />

      <div className="px-[18px] py-4">
        <div className="mb-2.5 flex items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-[#534AB7]">
            Top signal
          </span>
          <ZoneBadge zone={opportunity.actionability_zone} />
          <span
            className="ml-auto text-[11px]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {evidenceCount} cards · {challengeCount} challenge
            {challengeCount === 1 ? "" : "s"} · updated{" "}
            {formatUpdatedAgoShort(opportunity.last_updated)}
          </span>
        </div>

        <h2
          className="mb-1.5 text-base font-medium leading-snug"
          style={{ color: "var(--color-text-primary)" }}
        >
          {truncate(opportunity.hypothesis.statement, 120)}
        </h2>

        <p
          className="mb-3.5 text-[13px] leading-relaxed"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {truncate(opportunity.hypothesis.unmet_need, 180)}
        </p>

        <div className="flex items-center gap-4">
          <div className="flex shrink-0 items-baseline gap-1">
            <span
              className="text-[28px] font-medium tracking-tight tabular-nums"
              style={{ color: accentColor }}
            >
              {confidencePct}%
            </span>
            <span
              className="text-xs"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              confidence
            </span>
          </div>

          <ConfidenceBar
            score={opportunity.confidence_score}
            color={accentColor}
          />

          <AgentPips agents={agents} pulsingAgents={pulsingAgents} />

          <span
            className="shrink-0 text-[11px]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            6 agents watching
          </span>
        </div>
      </div>
    </Link>
  );
}
