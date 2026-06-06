import type { EvidenceCard } from "@/types/OpportunityObject";

/** Whether an evidence card should appear when a v2 hypothesis is selected. */
export function cardVisibleForHypothesis(
  card: EvidenceCard,
  selectedId: string | undefined
): boolean {
  if (!selectedId) return true;
  if (card.hypothesis_id === selectedId) return true;
  if (
    !card.hypothesis_id &&
    card.contributing_agent === "literature" &&
    !card.is_challenge
  ) {
    return true;
  }
  return false;
}

/** Limit mechanism pathway cards for outgroup calibration controls (V2-038). */
export function evidenceCardsForHypothesisScoring(
  cards: EvidenceCard[],
  isOutgroup: boolean
): EvidenceCard[] {
  const evidence = cards.filter((c) => !c.is_challenge);
  if (!isOutgroup) return evidence;

  const pathwayCards = evidence.filter(
    (c) => c.contributing_agent === "mechanism" && !c.is_target_list
  );
  if (pathwayCards.length <= 1) return evidence;

  const keepId = pathwayCards[0].id;
  return evidence.filter(
    (c) =>
      c.contributing_agent !== "mechanism" ||
      c.is_target_list ||
      c.id === keepId
  );
}
