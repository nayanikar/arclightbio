import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { OpportunityObject } from "@/types/OpportunityObject";
import {
  formatUserQuery,
  truncate,
  zoneAccentColor,
} from "@/lib/dashboardLayout";
import { ZoneBadge } from "./ZoneBadge";
import { ConfidenceBar } from "./ConfidenceBar";
import { cn } from "@/lib/utils";

interface AllOpportunitiesListProps {
  opportunities: OpportunityObject[];
}

function AllOpportunityRow({
  opportunity,
  isLast,
}: {
  opportunity: OpportunityObject;
  isLast: boolean;
}) {
  const zoneColor = zoneAccentColor(opportunity.actionability_zone);
  const confidencePct = Math.round(opportunity.confidence_score * 100);
  const evidenceCount = opportunity.evidence_cards.length;
  const challengeCount = opportunity.challenges.length;

  return (
    <Link
      href={`/opportunity/${opportunity.id}`}
      className={cn(
        "group relative flex items-center gap-3.5 px-[18px] py-3.5 transition-colors hover:bg-[var(--color-background-secondary)]",
        !isLast && "border-b"
      )}
      style={{
        borderColor: isLast ? undefined : "var(--color-border-tertiary)",
        borderBottomWidth: isLast ? undefined : 0.5,
        borderLeftWidth: 3,
        borderLeftStyle: "solid",
        borderLeftColor: zoneColor,
      }}
    >
      <div
        className="shrink-0 basis-[260px] text-sm font-medium"
        style={{ color: "var(--color-text-primary)" }}
      >
        {truncate(formatUserQuery(opportunity.search_query), 40)}
      </div>

      <p
        className="hidden min-w-0 flex-1 truncate text-xs min-[900px]:block"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        {truncate(opportunity.hypothesis.statement, 80)}
      </p>

      <div
        className="shrink-0 basis-[140px] text-right text-[11px]"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        {challengeCount > 0 ? (
          <>
            {evidenceCount} cards ·{" "}
            <span className="text-[#D85A30]">
              {challengeCount} challenge{challengeCount === 1 ? "" : "s"}
            </span>
          </>
        ) : (
          <>{evidenceCount} cards</>
        )}
      </div>

      <ConfidenceBar
        score={opportunity.confidence_score}
        color={zoneColor}
        height={4}
        className="shrink-0 basis-[100px]"
      />

      <span
        className="shrink-0 basis-[40px] text-right text-[13px] font-medium tabular-nums"
        style={{ color: zoneColor }}
      >
        {confidencePct}%
      </span>

      <div className="flex shrink-0 basis-[76px] justify-center">
        <ZoneBadge zone={opportunity.actionability_zone} />
      </div>

      <ArrowRight
        className="h-3.5 w-3.5 shrink-0 basis-5 opacity-40 transition-opacity group-hover:opacity-100"
        style={{ color: "var(--color-text-tertiary)" }}
      />
    </Link>
  );
}

export function AllOpportunitiesList({
  opportunities,
}: AllOpportunitiesListProps) {
  if (opportunities.length === 0) return null;

  return (
    <section>
      <div className="mb-3 mt-5 flex items-center gap-3">
        <span
          className="whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.08em]"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          All opportunities
        </span>
        <div
          className="h-px flex-1"
          style={{ background: "var(--color-border-tertiary)" }}
        />
        <span
          className="whitespace-nowrap text-[11px]"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          {opportunities.length} more
        </span>
      </div>

      <div
        className="overflow-hidden rounded-xl border"
        style={{
          background: "var(--color-background-primary)",
          borderColor: "var(--color-border-tertiary)",
          borderWidth: 0.5,
        }}
      >
        {opportunities.map((opp, index) => (
          <AllOpportunityRow
            key={opp.id}
            opportunity={opp}
            isLast={index === opportunities.length - 1}
          />
        ))}
      </div>
    </section>
  );
}
