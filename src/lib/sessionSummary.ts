import type {
  ActionabilityZone,
  EvidenceCard,
} from "@/types/OpportunityObject";
import type { ModalityAssessment } from "@/lib/modalityTypes";
import {
  findTargetListCard,
  parseRankedTargetsFromCard,
} from "@/lib/targetList";

const ZONE_LABELS: Record<ActionabilityZone, string> = {
  act_now: "Act Now",
  too_early: "Too Early",
  crowded: "Crowded",
};

export function buildSessionSummaryBullets(input: {
  confidenceScore: number;
  actionabilityZone: ActionabilityZone;
  cards: EvidenceCard[];
}): string[] {
  const bullets: string[] = [];
  const { confidenceScore, actionabilityZone, cards } = input;

  bullets.push(
    `${ZONE_LABELS[actionabilityZone]} at ${confidenceScore.toFixed(2)} confidence`
  );

  const targetList = findTargetListCard(cards);
  const targets = parseRankedTargetsFromCard(targetList);
  if (targets.length > 0) {
    const top = targets[0];
    const noveltyCard = cards.find((c) => c.is_novelty_check);
    const verdicts = noveltyCard?.raw_source_metadata?.novelty_verdicts as
      | Array<{ target?: string; verdict?: string }>
      | undefined;
    const novelty = verdicts?.find(
      (v) => v.target?.toUpperCase() === top.gene_symbol.toUpperCase()
    )?.verdict;
    bullets.push(
      `Top target: ${top.gene_symbol} (druggability ${top.druggability_composite.toFixed(2)}${novelty ? `, ${novelty.replace(/_/g, " ")}` : ""})`
    );
  }

  const modalityCard = cards.find((c) => c.is_modality_card);
  const assessments = modalityCard?.raw_source_metadata
    ?.modality_assessments as ModalityAssessment[] | undefined;
  if (assessments?.[0]) {
    const m = assessments[0];
    bullets.push(
      `Modality: ${m.target} → ${m.recommended_modality} (${m.estimated_timeline_to_IND})`
    );
  }

  const crossDomainCount = cards.filter((c) => c.is_cross_domain).length;
  if (crossDomainCount > 0) {
    bullets.push(
      `${crossDomainCount} cross-domain signal${crossDomainCount === 1 ? "" : "s"} detected`
    );
  }

  const challenges = cards.filter((c) => c.is_challenge);
  if (challenges.length > 0) {
    const derisk = challenges.find((c) => c.derisk_recommendation)?.derisk_recommendation;
    bullets.push(
      derisk
        ? `${challenges.length} regulatory challenge${challenges.length === 1 ? "" : "s"} — de-risk via ${derisk.study_type}`
        : `${challenges.length} regulatory challenge${challenges.length === 1 ? "" : "s"} flagged`
    );
  }

  return bullets.slice(0, 5);
}
