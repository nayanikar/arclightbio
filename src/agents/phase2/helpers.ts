import type { HypothesisRecord, OpportunityObject } from "@/types/OpportunityObject";
import type { DrugDiscoveryAssessment, RiskComponents } from "@/types/V3Pipeline";
import { callAgentJson } from "@/api/anthropic";
import { parentDomainLabel } from "@/lib/parentDomains";
import {
  getDrugDiscoveryAssessment,
  upsertDrugDiscoveryAssessment,
} from "@/lib/v3Db";

export interface Phase2Context {
  obj: OpportunityObject;
  hypothesis: HypothesisRecord;
  primaryTarget: string;
  indicationScope: string;
  programSentence: string;
}

export function buildPhase2Context(
  obj: OpportunityObject,
  hypothesis: HypothesisRecord
): Phase2Context {
  const ranked = hypothesis.ranked_targets ?? [];
  const primaryTarget =
    ranked[0]?.target_name ??
    ranked[0]?.gene_symbol ??
    hypothesis.statement.split(/\s+/).slice(0, 3).join(" ");

  return {
    obj,
    hypothesis,
    primaryTarget,
    indicationScope:
      hypothesis.patient_population ||
      obj.hypothesis.patient_population ||
      parentDomainLabel(obj.parent_domain),
    programSentence:
      obj.program_hypothesis_sentence ??
      obj.search_query ??
      hypothesis.statement,
  };
}

export function buildBlockedAssessment(
  reason: string,
  screenedPrimary?: string | null
): Partial<DrugDiscoveryAssessment> {
  return {
    drug_exists: false,
    branch: "new",
    pipeline_status: "blocked_undruggable",
    blocked_reason: reason,
    screened_primary_target: screenedPrimary ?? undefined,
    druggability_score: undefined,
    selected_modality: undefined,
    druggability_rationale: undefined,
    ip_summary: undefined,
    fto_summary: undefined,
  };
}

export function contextPrompt(ctx: Phase2Context): string {
  return `Program hypothesis: ${ctx.programSentence}
Selectivity hypothesis (rank ${ctx.hypothesis.rank ?? "?"}): ${ctx.hypothesis.statement}
Falsifiability: ${ctx.hypothesis.falsifiability_statement ?? "not specified"}
Anchor linkage: ${ctx.hypothesis.anchor_linkage ?? "not specified"}
Primary target: ${ctx.primaryTarget}
Indication scope: ${ctx.indicationScope}
Parent domain: ${parentDomainLabel(ctx.obj.parent_domain)}
Ranked targets: ${JSON.stringify(ctx.hypothesis.ranked_targets ?? [])}
Direction status: ${ctx.hypothesis.direction_status ?? "unknown"}
Intervention direction: ${ctx.hypothesis.intervention_direction_hypothesis ?? "unspecified"}`;
}

export async function mergeAssessment(
  opportunityId: string,
  hypothesisId: string,
  patch: Partial<DrugDiscoveryAssessment>
): Promise<DrugDiscoveryAssessment> {
  const existing = await getDrugDiscoveryAssessment(opportunityId, hypothesisId);
  const merged: DrugDiscoveryAssessment = {
    drug_exists: false,
    branch: "new",
    ...(existing?.assessment ?? {}),
    ...patch,
  };
  for (const key of Object.keys(patch) as (keyof DrugDiscoveryAssessment)[]) {
    if (patch[key] === undefined) {
      delete merged[key];
    }
  }
  const record = await upsertDrugDiscoveryAssessment(opportunityId, hypothesisId, {
    assessment: merged,
    drug_exists: patch.drug_exists ?? existing?.drug_exists ?? undefined,
    branch: patch.branch ?? existing?.branch ?? undefined,
  });
  return record.assessment;
}

export async function loadAssessment(
  opportunityId: string,
  hypothesisId: string
): Promise<DrugDiscoveryAssessment> {
  const record = await getDrugDiscoveryAssessment(opportunityId, hypothesisId);
  return (
    record?.assessment ?? {
      drug_exists: false,
      branch: "new",
    }
  );
}

export type RiskCategory = keyof RiskComponents;

export async function runRiskScorer(
  ctx: Phase2Context,
  category: RiskCategory,
  systemPrompt: string
): Promise<{ score: number; rationale: string }> {
  const assessment = await loadAssessment(ctx.obj.id, ctx.hypothesis.id);
  try {
    const result = await callAgentJson<{ score: number; rationale: string }>(
      systemPrompt,
      `${contextPrompt(ctx)}

Existing drug assessment: ${JSON.stringify(assessment)}
Selected modality: ${assessment.selected_modality ?? "not yet selected"}

Score ${category} risk from 0 (low) to 1 (high). Return JSON: { "score": number, "rationale": string }`
    );
    const score = Math.max(0, Math.min(1, Number(result.score) || 0.5));
    return { score, rationale: result.rationale ?? "" };
  } catch {
    return {
      score: 0.5,
      rationale: `[Fallback] ${category} risk scorer unavailable — default mid-range score.`,
    };
  }
}
