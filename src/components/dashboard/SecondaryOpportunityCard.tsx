import Link from "next/link";
import type { OpportunityObject } from "@/types/OpportunityObject";
import {
  firstSentence,
  formatUserQuery,
  zoneAccentColor,
} from "@/lib/dashboardLayout";
import { ZoneBadge } from "./ZoneBadge";
import { ConfidenceBar } from "./ConfidenceBar";
import { cn } from "@/lib/utils";

interface SecondaryOpportunityCardProps {
  opportunity: OpportunityObject;
  className?: string;
}

export function SecondaryOpportunityCard({
  opportunity,
  className,
}: SecondaryOpportunityCardProps) {
  const confidencePct = Math.round(opportunity.confidence_score * 100);
  const accentColor = zoneAccentColor(opportunity.actionability_zone);
  const evidenceCount = opportunity.evidence_cards.length;

  return (
    <Link
      href={`/opportunity/${opportunity.id}`}
      className={cn(
        "block overflow-hidden rounded-xl border bg-white transition-shadow hover:shadow-md",
        className
      )}
      style={{ borderColor: "var(--color-border-tertiary)", borderWidth: 0.5 }}
    >
      <div
        className="h-[3px] w-full"
        style={{ background: accentColor }}
      />

      <div className="px-4 py-3.5">
        <div className="mb-2 flex items-center gap-2">
          <ZoneBadge zone={opportunity.actionability_zone} />
          <span
            className="ml-auto text-[11px]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {evidenceCount} cards
          </span>
        </div>

        <h3
          className="mb-1.5 text-sm font-medium leading-snug"
          style={{ color: "var(--color-text-primary)" }}
        >
          {formatUserQuery(opportunity.search_query)}
        </h3>

        <p
          className="mb-3 text-xs leading-normal"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {firstSentence(opportunity.hypothesis.statement, 120)}
        </p>

        <div className="flex items-center gap-3">
          <span
            className="shrink-0 text-[22px] font-medium tabular-nums"
            style={{ color: accentColor }}
          >
            {confidencePct}%
          </span>
          <ConfidenceBar
            score={opportunity.confidence_score}
            color={accentColor}
            height={5}
          />
        </div>
      </div>
    </Link>
  );
}
