import type { HypothesisRecord } from "@/types/OpportunityObject";
import type { OrganizationContext } from "@/types/OrganizationContext";
import type { DecisionBriefPortfolioFit } from "@/types/DecisionBrief";

function normalize(text: string): string {
  return text.toLowerCase().replace(/\W+/g, " ");
}

function tokenOverlap(a: string, b: string): boolean {
  const wordsA = new Set(normalize(a).split(" ").filter((w) => w.length > 4));
  const wordsB = normalize(b).split(" ").filter((w) => w.length > 4);
  return wordsB.some((w) => wordsA.has(w));
}

export function computePortfolioFit(
  hypothesis: HypothesisRecord,
  org: OrganizationContext | null
): DecisionBriefPortfolioFit {
  if (!org) {
    return {
      therapeutic_area_overlap: false,
      modality_in_platform: false,
      summary: "Org context unavailable — portfolio fit not assessed.",
    };
  }

  const taText = [
    hypothesis.statement,
    hypothesis.patient_population,
    hypothesis.unmet_need,
  ].join(" ");

  const therapeutic_area_overlap = org.portfolio.therapeutic_areas.some(
    (ta) => tokenOverlap(taText, ta)
  );

  const modalityLabel = hypothesis.declared_modality?.replace(/_/g, " ") ?? "";
  const modality_in_platform =
    modalityLabel.length > 0 &&
    org.portfolio.platforms.some((p) =>
      tokenOverlap(modalityLabel, p.replace(/_/g, " "))
    );

  const parts: string[] = [];
  if (therapeutic_area_overlap) {
    parts.push("Therapeutic area aligns with org portfolio.");
  } else {
    parts.push("Limited therapeutic-area overlap with org portfolio.");
  }
  if (modality_in_platform) {
    parts.push("Declared modality matches an org platform.");
  } else if (modalityLabel) {
    parts.push(`Modality (${modalityLabel}) is not a listed org platform.`);
  }

  return {
    therapeutic_area_overlap,
    modality_in_platform,
    summary: parts.join(" "),
  };
}
