import type { HypothesisRecord, OpportunityObject } from "@/types/OpportunityObject";
import { callAgentJson } from "@/api/anthropic";
import { getTargetDiseaseAssociations } from "@/api/openTargets";
import type { RankedTarget } from "@/lib/targetList";
import {
  isTargetUndraggable,
  listGlobalUndruggableTargets,
  listUndruggableTargets,
} from "@/lib/v3Db";
import { buildPhase2Context, contextPrompt, loadAssessment, mergeAssessment } from "./helpers";

const DRUGGABILITY_SYSTEM = `You are a drug discovery scientist evaluating targets for first-in-class therapeutic development.
HARD RULE: If target is in undruggable registry or failed all three modality screens, return druggability_score: 0 and state undruggable in rationale.
Score druggability from 0-1 across structural_druggability, pathway_confidence, clinical_novelty, safety_precedent.
Return valid JSON:
{
  "druggability_score": number,
  "druggability_rationale": string,
  "ranked_targets": [{
    "target_name": string,
    "gene_symbol": string,
    "structural_druggability": number,
    "pathway_confidence": number,
    "clinical_novelty": number,
    "safety_precedent": number,
    "rationale": string,
    "recommended_modality": string
  }]
}`;

export async function druggabilityAssessmentAgent(
  obj: OpportunityObject,
  hypothesis: HypothesisRecord
): Promise<void> {
  const ctx = buildPhase2Context(obj, hypothesis);
  const assessment = await loadAssessment(obj.id, hypothesis.id);

  if (assessment.pipeline_status === "blocked_undruggable") {
    return;
  }

  const [sessionRegistry, globalRegistry] = await Promise.all([
    listUndruggableTargets(obj.id),
    listGlobalUndruggableTargets(),
  ]);
  const registry = [...sessionRegistry, ...globalRegistry];
  if (isTargetUndraggable(ctx.primaryTarget, registry)) {
    await mergeAssessment(obj.id, hypothesis.id, {
      druggability_score: 0,
      druggability_rationale:
        "Target failed undruggability screen or appears in undruggable registry — direct modulation not scored.",
      pipeline_status: "blocked_undruggable",
    });
    return;
  }

  if (assessment.branch === "existing") {
    await mergeAssessment(obj.id, hypothesis.id, {
      druggability_score: 0.7,
      druggability_rationale:
        "Existing drug path — druggability de-emphasized; leverage known chemical matter.",
    });
    return;
  }

  let associations: Awaited<ReturnType<typeof getTargetDiseaseAssociations>> = [];
  try {
    associations = await getTargetDiseaseAssociations(ctx.primaryTarget);
  } catch {
    // non-fatal
  }

  const targetsJson = JSON.stringify(
    (hypothesis.ranked_targets ?? []).length > 0
      ? hypothesis.ranked_targets
      : associations.slice(0, 8).map((a) => ({
          target_name: a.targetName,
          disease: a.diseaseName,
          association_score: a.score,
        }))
  );

  try {
    const result = await callAgentJson<{
      druggability_score: number;
      druggability_rationale: string;
      ranked_targets?: RankedTarget[];
    }>(
      DRUGGABILITY_SYSTEM,
      `${contextPrompt(ctx)}
Open Targets associations: ${associations.length}
Hypothesis ranked targets: ${targetsJson}`
    );

    const score = Math.max(0, Math.min(1, result.druggability_score ?? 0.5));
    await mergeAssessment(obj.id, hypothesis.id, {
      druggability_score: score,
      druggability_rationale: result.druggability_rationale,
    });
  } catch {
    const fallbackScore =
      hypothesis.ranked_targets?.[0]?.selectivity_feasibility ?? 0.5;
    await mergeAssessment(obj.id, hypothesis.id, {
      druggability_score: fallbackScore,
      druggability_rationale:
        "[Fallback] Druggability scoring unavailable — using selectivity feasibility proxy.",
    });
  }
}
