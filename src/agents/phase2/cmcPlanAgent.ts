import type { HypothesisRecord, OpportunityObject } from "@/types/OpportunityObject";
import { callAgentJson } from "@/api/anthropic";
import { getIndRegulatoryPackage, upsertIndRegulatoryPackage } from "@/lib/v3Db";
import { buildPhase2Context, contextPrompt, loadAssessment } from "./helpers";

const SYSTEM = `You are a CMC strategist. Outline chemistry/manufacturing/control requirements for IND.
Return valid JSON: { "cmc_requirements": string[] }`;

export async function cmcPlanAgent(
  obj: OpportunityObject,
  hypothesis: HypothesisRecord
): Promise<void> {
  const ctx = buildPhase2Context(obj, hypothesis);
  const assessment = await loadAssessment(obj.id, hypothesis.id);
  const existing = await getIndRegulatoryPackage(obj.id, hypothesis.id);

  let requirements: string[];
  try {
    const result = await callAgentJson<{ cmc_requirements: string[] }>(
      SYSTEM,
      `${contextPrompt(ctx)}
Modality: ${assessment.selected_modality ?? "TBD"}`
    );
    requirements = result.cmc_requirements;
  } catch {
    requirements = [
      "Drug substance synthesis/process development",
      "Analytical method development and validation",
      "Stability studies per ICH guidelines",
      "GMP manufacturing scale-up plan",
    ];
  }

  await upsertIndRegulatoryPackage(obj.id, hypothesis.id, {
    package: {
      ...(existing?.package ?? {}),
      cmc_requirements: requirements,
    },
  });
}
