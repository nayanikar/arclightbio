import type { HypothesisRecord, OpportunityObject } from "@/types/OpportunityObject";
import { callAgentJson } from "@/api/anthropic";
import { getIndRegulatoryPackage, upsertIndRegulatoryPackage } from "@/lib/v3Db";
import { buildPhase2Context, contextPrompt, loadAssessment } from "./helpers";

const SYSTEM = `You are a toxicology strategist for IND-enabling studies.
Return valid JSON: { "tox_studies": string[] }`;

export async function toxicologyPlanAgent(
  obj: OpportunityObject,
  hypothesis: HypothesisRecord
): Promise<void> {
  const ctx = buildPhase2Context(obj, hypothesis);
  const assessment = await loadAssessment(obj.id, hypothesis.id);
  const existing = await getIndRegulatoryPackage(obj.id, hypothesis.id);

  let studies: string[];
  try {
    const result = await callAgentJson<{ tox_studies: string[] }>(
      SYSTEM,
      `${contextPrompt(ctx)}
Modality: ${assessment.selected_modality ?? "TBD"}`
    );
    studies = result.tox_studies;
  } catch {
    studies = [
      "Rodent 28-day repeat-dose tox with TK",
      "Non-rodent GLP tox (species per modality)",
      "Safety pharmacology core battery",
      "Genotoxicity panel per ICH S2",
    ];
  }

  await upsertIndRegulatoryPackage(obj.id, hypothesis.id, {
    package: {
      ...(existing?.package ?? {}),
      tox_studies: studies,
    },
  });
}
