import type { EvidenceCard } from "@/types/OpportunityObject";
import type { CompetitiveLandscape } from "@/types/DecisionBrief";
import { searchFDAApprovals } from "@/api/openFda";
import { searchTrialsByTerm } from "@/api/clinicalTrials";

export async function buildCompetitiveLandscape(
  searchQuery: string,
  indication: string,
  cards: EvidenceCard[]
): Promise<CompetitiveLandscape> {
  const approved: string[] = [];
  const active: string[] = [];
  const failed: string[] = [];

  try {
    const fda = await searchFDAApprovals(searchQuery, indication, 5);
    approved.push(
      ...fda.map((d) => d.brandName ?? d.genericName ?? "Unknown")
    );
  } catch {
    // non-fatal
  }

  try {
    const trials = await searchTrialsByTerm(searchQuery, 15, false);
    for (const t of trials) {
      if (/RECRUITING|ACTIVE|NOT_YET_RECRUITING/i.test(t.status)) {
        active.push(t.title.slice(0, 80));
      } else if (
        /TERMINATED|WITHDRAWN|SUSPENDED|COMPLETED.*FAIL/i.test(t.status) ||
        t.whyStopped
      ) {
        failed.push(
          `${t.title.slice(0, 60)} (${t.status}${t.whyStopped ? `: ${t.whyStopped.slice(0, 40)}` : ""})`
        );
      }
    }
  } catch {
    // non-fatal
  }

  const commercialCard = cards.find((c) => c.contributing_agent === "commercial");
  const noveltyCard = cards.find((c) => c.is_novelty_check);
  const patentCount =
    typeof commercialCard?.raw_source_metadata?.patent_count === "number"
      ? (commercialCard.raw_source_metadata.patent_count as number)
      : 0;

  const patent_density =
    patentCount > 10
      ? "High patent activity"
      : patentCount > 3
        ? "Moderate patent activity"
        : "Low patent density";

  const noveltyStatement =
    (noveltyCard?.raw_source_metadata?.novelty_verdicts as Array<{ differentiation_angle?: string }> | undefined)?.[0]
      ?.differentiation_angle ?? "";

  return {
    approved: approved.slice(0, 5),
    active: active.slice(0, 5),
    failed: failed.slice(0, 5),
    patent_density,
    differentiation_summary:
      noveltyStatement ||
      commercialCard?.content.slice(0, 200) ||
      "Competitive landscape assessed from available trial and IP data.",
  };
}
