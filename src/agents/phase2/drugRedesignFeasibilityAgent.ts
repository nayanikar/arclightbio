import type { HypothesisRecord, OpportunityObject } from "@/types/OpportunityObject";
import { callAgentJson } from "@/api/anthropic";
import { buildPhase2Context, contextPrompt, loadAssessment, mergeAssessment } from "./helpers";

const SYSTEM = `You are a medicinal chemistry strategist evaluating whether an existing drug can be redesigned for a new indication using the 75% structural conservation heuristic.
Return valid JSON:
{
  "redesign_feasibility": string,
  "conservation_estimate_pct": number,
  "viable": boolean,
  "key_modifications": string[]
}`;

export async function drugRedesignFeasibilityAgent(
  obj: OpportunityObject,
  hypothesis: HypothesisRecord
): Promise<void> {
  const ctx = buildPhase2Context(obj, hypothesis);
  const assessment = await loadAssessment(obj.id, hypothesis.id);

  if (assessment.branch !== "existing") {
    await mergeAssessment(obj.id, hypothesis.id, {
      redesign_feasibility: "Not applicable — new drug development path selected.",
    });
    return;
  }

  try {
    const result = await callAgentJson<{
      redesign_feasibility: string;
      conservation_estimate_pct: number;
      viable: boolean;
    }>(
      SYSTEM,
      `${contextPrompt(ctx)}
Existing drug: ${assessment.existing_drug_name ?? "unknown"}
Mechanism: ${assessment.existing_drug_mechanism ?? "unknown"}`
    );
    await mergeAssessment(obj.id, hypothesis.id, {
      redesign_feasibility: `${result.redesign_feasibility} (est. ${result.conservation_estimate_pct}% conservation, viable: ${result.viable})`,
    });
  } catch {
    await mergeAssessment(obj.id, hypothesis.id, {
      redesign_feasibility:
        "[Fallback] Redesign feasibility requires cheminformatics — 75% conservation rule not yet computed.",
    });
  }
}
