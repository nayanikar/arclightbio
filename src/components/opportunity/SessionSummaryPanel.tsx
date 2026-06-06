"use client";

import { useMemo } from "react";
import { Panel } from "@/components/layout/Panel";
import { useOpportunityStore } from "@/store/opportunityStore";
import type { EvidenceCard, ActionabilityZone } from "@/types/OpportunityObject";
import { buildSessionSummaryBullets } from "@/lib/sessionSummary";

export function SessionSummaryPanel({
  cards,
  confidenceScore: confidenceOverride,
  actionabilityZone: zoneOverride,
}: {
  cards?: EvidenceCard[];
  confidenceScore?: number;
  actionabilityZone?: ActionabilityZone;
}) {
  const { streamingCards, confidenceScore, actionabilityZone } =
    useOpportunityStore();

  const effectiveCards = cards ?? streamingCards;
  const effectiveConfidence = confidenceOverride ?? confidenceScore;
  const effectiveZone = zoneOverride ?? actionabilityZone;

  const bullets = useMemo(
    () =>
      buildSessionSummaryBullets({
        confidenceScore: effectiveConfidence,
        actionabilityZone: effectiveZone,
        cards: effectiveCards,
      }),
    [effectiveConfidence, effectiveZone, effectiveCards]
  );

  if (bullets.length === 0) return null;

  return (
    <Panel title="Session summary">
      <ul className="space-y-2">
        {bullets.map((bullet, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-sm leading-relaxed text-gray-700"
          >
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand-purple/60" />
            {bullet}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
