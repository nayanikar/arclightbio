import type { OpportunityObject } from "@/types/OpportunityObject";
import { callAgentJson } from "@/api/anthropic";
import {
  getOpportunityObject,
  getOrgContext,
  getAllEvidenceCards,
  insertEvidenceCard,
} from "@/lib/db";
import { findTargetListCard, type RankedTarget } from "@/lib/targetList";
import type { ModalityAssessment } from "@/lib/modalityTypes";

export type { ModalityAssessment };

const MODALITY_SYSTEM = `You are a drug modality expert advising on first-in-class therapeutic development.
Return valid JSON only — a JSON array of modality assessments.`;

function formatModalityAssessment(assessments: ModalityAssessment[]): string {
  const lines = assessments.map(
    (a) =>
      `${a.target} → ${a.recommended_modality}
Timeline to IND: ${a.estimated_timeline_to_IND}
Manufacturing complexity: ${"●".repeat(a.manufacturing_complexity)}${"○".repeat(Math.max(0, 5 - a.manufacturing_complexity))} (${a.manufacturing_complexity}/5)
Org fit: ${a.org_fit_score >= 0.7 ? "High" : a.org_fit_score >= 0.4 ? "Moderate" : "Low"} (${a.org_fit_score.toFixed(2)})
Key infrastructure: ${a.key_infrastructure_requirement}
Alternative: ${a.alternative_modality} — ${a.alternative_rationale}`
  );
  return `MODALITY RECOMMENDATION\n${"─".repeat(40)}\n${lines.join("\n\n")}`;
}

export async function modalityAgent(obj: OpportunityObject): Promise<void> {
  const fresh = (await getOpportunityObject(obj.id)) ?? obj;
  const allCards = await getAllEvidenceCards(obj.id);
  const targetListCard = findTargetListCard(allCards);
  if (!targetListCard) return;

  const rankedTargets = (targetListCard.raw_source_metadata?.ranked_targets ??
    []) as RankedTarget[];
  const org = await getOrgContext(fresh.org_context_id);
  const platforms = org?.portfolio.platforms ?? [];

  const prompt = `For each prioritized target below, recommend the optimal drug modality and assess manufacturing/infrastructure feasibility.

Targets:
${targetListCard.content}

Indication: ${fresh.hypothesis.patient_population}
Org platforms: ${platforms.join(", ") || "Not specified"}

For each target evaluate: Small molecule, Biologic/mAb, ADC, RNA therapy, Cell therapy, Gene therapy, Protein degrader (PROTAC).

Return:
[{
  "target": string,
  "recommended_modality": string,
  "modality_rationale": string,
  "manufacturing_complexity": 1-5,
  "estimated_timeline_to_IND": string,
  "org_fit_score": number,
  "key_infrastructure_requirement": string,
  "alternative_modality": string,
  "alternative_rationale": string
}]`;

  let assessments: ModalityAssessment[] = [];
  try {
    assessments = await callAgentJson<ModalityAssessment[]>(MODALITY_SYSTEM, prompt);
    if (!Array.isArray(assessments)) assessments = [];
  } catch {
    assessments = rankedTargets.slice(0, 3).map((t) => ({
      target: t.gene_symbol,
      recommended_modality: t.recommended_modality,
      modality_rationale: `Default recommendation based on target class for ${t.target_name}.`,
      manufacturing_complexity: 2,
      estimated_timeline_to_IND: "3-4 years",
      org_fit_score: platforms.some((p) =>
        t.recommended_modality.toLowerCase().includes(p.toLowerCase().split(" ")[0])
      )
        ? 0.75
        : 0.45,
      key_infrastructure_requirement: "Standard medicinal chemistry",
      alternative_modality: "Biologic / monoclonal antibody",
      alternative_rationale: "Higher specificity if small molecule selectivity is challenging.",
    }));
  }

  if (assessments.length === 0) return;

  await insertEvidenceCard(fresh.id, {
    content: formatModalityAssessment(assessments),
    source_url: "",
    source_type: "internal_reasoning",
    contributing_agent: "modality",
    is_modality_card: true,
    quality_scores: {
      sample_size: 0.5,
      study_design: 0.6,
      source_credibility: 0.7,
      replication: 0.5,
      recency: 0.8,
      composite: 0.75,
    },
    regulatory_weight: 0.75,
    raw_source_metadata: {
      modality_assessments: assessments,
      org_platforms: platforms,
    },
  });
}

export { formatModalityAssessment };
