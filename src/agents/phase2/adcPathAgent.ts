import type { HypothesisRecord, OpportunityObject } from "@/types/OpportunityObject";
import { callAgentJson } from "@/api/anthropic";
import { buildPhase2Context, contextPrompt, loadAssessment, mergeAssessment } from "./helpers";

const SYSTEM = `You are an ADC (antibody-drug conjugate) development strategist.
Evaluate whether an ADC path is viable for the target and indication, including target internalization and payload selection.
Return valid JSON: { "adc_path_viable": boolean, "rationale": string, "payload_recommendation": string }`;

export async function adcPathAgent(
  obj: OpportunityObject,
  hypothesis: HypothesisRecord
): Promise<void> {
  const ctx = buildPhase2Context(obj, hypothesis);
  const assessment = await loadAssessment(obj.id, hypothesis.id);

  try {
    const result = await callAgentJson<{
      adc_path_viable: boolean;
      rationale: string;
    }>(
      SYSTEM,
      `${contextPrompt(ctx)}
Branch: ${assessment.branch}
Existing drug: ${assessment.existing_drug_name ?? "none"}`
    );
    await mergeAssessment(obj.id, hypothesis.id, {
      adc_path_viable: result.adc_path_viable,
    });
  } catch {
    await mergeAssessment(obj.id, hypothesis.id, {
      adc_path_viable: false,
    });
  }
}
