"use client";

import { useState } from "react";
import type { EvidenceCard } from "@/types/OpportunityObject";
import { Panel } from "@/components/layout/Panel";
import {
  parseRankedTargetsFromCard,
  findTargetListCard,
  type RankedTarget,
} from "@/lib/targetList";
import { ChevronDown, ChevronUp } from "lucide-react";

function DruggabilityBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[10px] text-gray-500">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-agent-mechanism"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function TargetRow({
  target,
  noveltyVerdict,
}: {
  target: RankedTarget;
  noveltyVerdict?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const compositePct = Math.round(target.druggability_composite * 100);

  return (
    <div className="rounded-lg border border-gray-100 bg-white p-3">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-2 text-left"
      >
        <span className="text-xs font-bold text-gray-400">#{target.priority_rank}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-gray-900">{target.gene_symbol}</span>
            <span className="text-xs text-gray-500">
              Druggability: {compositePct}%
            </span>
            {noveltyVerdict && (
              <span className="rounded bg-brand-teal/10 px-1.5 py-0.5 text-[10px] font-medium text-brand-teal">
                {noveltyVerdict}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-gray-600 line-clamp-2">
            {target.rationale}
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
        )}
      </button>
      {expanded && (
        <div className="mt-3 space-y-2 border-t border-gray-50 pt-3">
          <DruggabilityBar label="Structural" value={target.structural_druggability} />
          <DruggabilityBar label="Pathway" value={target.pathway_confidence} />
          <DruggabilityBar label="Novelty" value={target.clinical_novelty} />
          <DruggabilityBar label="Safety" value={target.safety_precedent} />
          <p className="text-xs text-gray-500">
            Modality: {target.recommended_modality}
          </p>
          <p className="text-xs text-brand-coral">Risk: {target.key_risk}</p>
        </div>
      )}
    </div>
  );
}

function noveltyVerdictForTarget(
  cards: EvidenceCard[],
  geneSymbol: string
): string | undefined {
  const noveltyCard = cards.find((c) => c.is_novelty_check);
  if (!noveltyCard) return undefined;
  const verdicts = noveltyCard.raw_source_metadata?.novelty_verdicts as
    | Array<{ target?: string; verdict?: string }>
    | undefined;
  const match = verdicts?.find(
    (v) => v.target?.toUpperCase() === geneSymbol.toUpperCase()
  );
  return match?.verdict;
}

export function PrioritizedTargetsPanel({ cards }: { cards: EvidenceCard[] }) {
  const targetListCard = findTargetListCard(cards);
  const targets = parseRankedTargetsFromCard(targetListCard);

  if (targets.length === 0) return null;

  return (
    <Panel
      title="Prioritized targets"
      description={`${targets.length} ranked by druggability composite`}
    >
      <div className="space-y-2">
        {targets.map((t) => (
          <TargetRow
            key={t.priority_rank}
            target={t}
            noveltyVerdict={noveltyVerdictForTarget(cards, t.gene_symbol)}
          />
        ))}
      </div>
    </Panel>
  );
}
