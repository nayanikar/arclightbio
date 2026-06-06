import type { HypothesisRecord, OpportunityObject } from "@/types/OpportunityObject";
import { callAgentJson } from "@/api/anthropic";
import { getOrgContext } from "@/lib/db";
import { buildPhase2Context, contextPrompt, loadAssessment, mergeAssessment } from "./helpers";

const SYSTEM = `You are a drug modality expert for first-in-class development.
Select optimal modality. When intervention direction is disputed, note direction_status and do not assert agonist/antagonist as settled.
Return valid JSON:
{
  "selected_modality": string,
  "modality_rationale": string,
  "manufacturing_complexity": number,
  "estimated_timeline_to_IND": string,
  "direction_note": string | null
}`;

export async function modalitySelectorAgent(
  obj: OpportunityObject,
  hypothesis: HypothesisRecord
): Promise<void> {
  const ctx = buildPhase2Context(obj, hypothesis);
  const assessment = await loadAssessment(obj.id, hypothesis.id);
  const org = await getOrgContext(obj.org_context_id);

  try {
    const result = await callAgentJson<{
      selected_modality: string;
      modality_rationale: string;
    }>(
      SYSTEM,
      `${contextPrompt(ctx)}
Druggability score: ${assessment.druggability_score ?? "not scored"}
ADC viable: ${assessment.adc_path_viable ?? false}
Org platforms: ${org?.portfolio.platforms?.join(", ") ?? "unknown"}`
    );
    await mergeAssessment(obj.id, hypothesis.id, {
      selected_modality: result.selected_modality,
      modality_rationale: result.modality_rationale,
    });
  } catch {
    const modality = assessment.adc_path_viable ? "ADC" : "small molecule";
    await mergeAssessment(obj.id, hypothesis.id, {
      selected_modality: modality,
      modality_rationale: `[Fallback] Default ${modality} modality pending expert review.`,
    });
  }
}
