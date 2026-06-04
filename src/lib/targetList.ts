import type { EvidenceCard } from "@/types/OpportunityObject";

export interface RankedTarget {
  target_name: string;
  gene_symbol: string;
  structural_druggability: number;
  pathway_confidence: number;
  clinical_novelty: number;
  safety_precedent: number;
  druggability_composite: number;
  priority_rank: number;
  rationale: string;
  recommended_modality: string;
  key_risk: string;
}

export function formatTargetList(targets: RankedTarget[]): string {
  if (targets.length === 0) return "No prioritized targets identified.";

  const lines = targets.map((t) => {
    const bar = "█".repeat(Math.round(t.druggability_composite * 10));
    return `#${t.priority_rank} ${t.gene_symbol} (${t.target_name}) — Druggability: ${bar} ${t.druggability_composite.toFixed(2)}
  Structural: ${t.structural_druggability.toFixed(2)} | Pathway: ${t.pathway_confidence.toFixed(2)} | Novel: ${t.clinical_novelty.toFixed(2)} | Safety: ${t.safety_precedent.toFixed(2)}
  ${t.rationale}
  Recommended modality: ${t.recommended_modality}
  Key risk: ${t.key_risk}`;
  });

  return `PRIORITIZED TARGETS\n${"─".repeat(50)}\n${lines.join("\n\n")}`;
}

export function parseRankedTargetsFromCard(
  card: EvidenceCard | undefined
): RankedTarget[] {
  if (!card) return [];
  const raw = card.raw_source_metadata?.ranked_targets;
  if (!Array.isArray(raw)) return [];
  return raw as RankedTarget[];
}

export function findTargetListCard(
  cards: EvidenceCard[]
): EvidenceCard | undefined {
  return cards.find(
    (c) => c.is_target_list && c.contributing_agent === "mechanism"
  );
}

export function computeDruggabilityComposite(target: {
  structural_druggability: number;
  pathway_confidence: number;
  clinical_novelty: number;
  safety_precedent: number;
}): number {
  return (
    target.structural_druggability * 0.3 +
    target.pathway_confidence * 0.3 +
    target.clinical_novelty * 0.25 +
    target.safety_precedent * 0.15
  );
}
