import type { HypothesisRecord, OpportunityObject } from "@/types/OpportunityObject";
import { callAgentJson } from "@/api/anthropic";
import { discoverySystemPrompt, narrativeTemperature } from "@/lib/innovationProfile";
import { buildPhase2Context, contextPrompt, loadAssessment, mergeAssessment } from "./helpers";
import { getActiveTrailCapture } from "@/lib/trailCapture";

const SYSTEM = `You are an FTO (freedom-to-operate) analyst for drug development.
Assess whether development can proceed without blocking third-party IP for the proposed modality and indication.
Return valid JSON: { "fto_summary": string, "blocking_risks": string[], "fto_status": "clear" | "caution" | "blocked" }`;

export async function ftoAnalysisAgent(
  obj: OpportunityObject,
  hypothesis: HypothesisRecord
): Promise<void> {
  const ctx = buildPhase2Context(obj, hypothesis);
  const assessment = await loadAssessment(obj.id, hypothesis.id);

  try {
    const result = await callAgentJson<{
      fto_summary: string;
      blocking_risks: string[];
      fto_status: string;
    }>(
      discoverySystemPrompt(SYSTEM, obj),
      `${contextPrompt(ctx)}
IP summary: ${assessment.ip_summary ?? "not yet assessed"}
Existing drug: ${assessment.existing_drug_name ?? "none identified"}`,
      { temperature: narrativeTemperature(obj) }
    );
    const trail = getActiveTrailCapture();
    trail?.setSummary(result.fto_summary);
    for (const risk of result.blocking_risks ?? []) {
      trail?.addReasoning(risk);
    }
    await mergeAssessment(obj.id, hypothesis.id, {
      fto_summary: result.fto_summary,
    });
  } catch {
    const trail = getActiveTrailCapture();
    trail?.setSummary(
      "FTO analysis pending — review patent landscape and composition-of-matter claims manually."
    );
    await mergeAssessment(obj.id, hypothesis.id, {
      fto_summary:
        "[Fallback] FTO analysis pending — review patent landscape and composition-of-matter claims manually.",
    });
  }
}
