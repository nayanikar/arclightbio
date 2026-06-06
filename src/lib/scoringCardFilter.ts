import type { EvidenceCard } from "@/types/OpportunityObject";

const FAILURE_CONTENT_PREFIXES = [
  /^no pubmed/i,
  /^literature search returned no/i,
  /^regulatory audit complete/i,
  /^ip landscape partially assessed.*unavailable/i,
  /^rwe signal search returned no/i,
];

/** Cards that must not inflate confidence or actionability (P3-005, P3-010). */
export function isScorableEvidenceCard(card: EvidenceCard): boolean {
  if (card.is_challenge) return false;
  if (card.contributing_agent === "regulatory") return false;

  const meta = card.raw_source_metadata ?? {};
  if (meta.partial || meta.lensMissing || meta.filter_failed) return false;
  if (meta.challengeCapReached || meta.phase === "surveillance") return false;
  if (meta.weak_association) return false;

  const content = card.content.trim();
  if (FAILURE_CONTENT_PREFIXES.some((re) => re.test(content))) return false;

  return true;
}

export function scorableEvidenceCards(cards: EvidenceCard[]): EvidenceCard[] {
  return cards.filter(isScorableEvidenceCard);
}
