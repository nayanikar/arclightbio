import { callAgentJson } from "@/api/anthropic";
import type { HypothesisRecord, OpportunityObject } from "@/types/OpportunityObject";
import type { ProgramTrustBreakdown } from "@/types/V3Pipeline";
import { updateHypothesis } from "@/lib/db";
import {
  computeProgramTrustScore,
  trustLabelFromOverall,
} from "@/lib/programTrustScore";
import {
  buildPhase1PromptHeader,
  formatCohortBlock,
  formatExpertDomains,
  JSON_ONLY_SUFFIX,
  loadPhase1Context,
  resolveCohort,
} from "./shared";

const SYSTEM = `You are the Program Confidence Agent for Arclight Bio.
Assess discovery confidence for a pharmaceutical research program based ONLY on the artifacts provided.

Rules:
- Scores must reflect the specific query, cohort, hypotheses, mechanistic chains, and evidence described — never use a default or template score.
- overall (0–1): integrated judgment of how well the program thesis is supported for a go/no-go portfolio view.
- funnel_coverage (0–1): breadth and quality of the hypothesis funnel (association → causation → selectivity).
- evidence_strength (0–1): depth and quality of mechanistic / literature / trial support for top selectivity hypotheses.
- biology_signal (0–1): strength of cross-domain biology and expert-domain recurrence vs the clinical query.
- label: exploratory (<0.45), moderate (0.45–0.69), strong (≥0.70).
- rationale: 2–3 sentences citing specific program artifacts (hypothesis statements, chain gaps, cohort patterns, falsification design).
- hypothesis_confidences: per top-3 selectivity hypothesis — confidence (0–1) and one-sentence rationale tied to that hypothesis's chain and falsification plan.

Do NOT anchor on round numbers like 0.44 or 0.50 unless the evidence truly supports them.
Return valid JSON only.${JSON_ONLY_SUFFIX}`;

interface ConfidencePayload {
  overall: number;
  funnel_coverage: number;
  evidence_strength: number;
  biology_signal: number;
  label?: "exploratory" | "moderate" | "strong";
  rationale?: string;
  hypothesis_confidences?: Array<{
    hypothesis_id: string;
    confidence: number;
    rationale?: string;
  }>;
}

function clamp01(n: number): number {
  if (typeof n !== "number" || Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function selectivityTop(hypotheses: HypothesisRecord[]): HypothesisRecord[] {
  return hypotheses
    .filter((h) => !h.is_outgroup)
    .filter(
      (h) =>
        h.hypothesis_stage === "selectivity" ||
        (h.rank != null && h.rank >= 1 && h.rank <= 3)
    )
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
    .slice(0, 3);
}

function funnelCounts(hypotheses: HypothesisRecord[]) {
  const nonOut = hypotheses.filter((h) => !h.is_outgroup);
  return {
    association: nonOut.filter((h) => h.hypothesis_stage === "association").length,
    causation: nonOut.filter((h) => h.hypothesis_stage === "causation").length,
    selectivity: nonOut.filter(
      (h) =>
        h.hypothesis_stage === "selectivity" ||
        (h.rank != null && h.rank >= 1 && h.rank <= 3)
    ).length,
  };
}

function formatSelectivityBlock(hyps: HypothesisRecord[]): string {
  if (hyps.length === 0) return "No selectivity hypotheses yet.";
  return hyps
    .map((h, i) => {
      const chain = h.mechanistic_chain;
      const gaps = chain?.gaps?.slice(0, 3).join("; ") || "none listed";
      const targets =
        h.ranked_targets
          ?.slice(0, 2)
          .map((t) => t.target_name || t.gene_symbol)
          .filter(Boolean)
          .join(", ") || "none ranked";
      return `${i + 1}. [id:${h.id}] rank=${h.rank ?? "?"} — ${h.statement}
   Chain confidence: ${chain?.overall_chain_confidence ?? "n/a"}; gaps: ${gaps}
   Targets: ${targets}
   Falsification: ${h.falsification_experiment?.objective ?? h.falsifiability_statement ?? "n/a"}`;
    })
    .join("\n");
}

function buildUserPrompt(
  obj: OpportunityObject,
  cohortBlock: string,
  phase: "phase1_complete" | "phase2_complete"
): string {
  const counts = funnelCounts(obj.hypotheses ?? []);
  const top = selectivityTop(obj.hypotheses ?? []);

  return `${buildPhase1PromptHeader(obj)}

Assessment phase: ${phase === "phase2_complete" ? "Phase 2 complete (includes druggability / TPP / risk artifacts)" : "Phase 1 complete (funnel + selectivity only)"}

${cohortBlock}

Funnel counts — association: ${counts.association}, causation: ${counts.causation}, selectivity: ${counts.selectivity}

Expert domains:
${formatExpertDomains(obj.expert_domains)}

CD2 associations: ${obj.cd2_associations?.length ?? 0} mined

Top selectivity hypotheses:
${formatSelectivityBlock(top)}

Program population thesis: ${obj.program_hypothesis_sentence ?? "n/a"}

Phase 2 druggability: ${obj.drug_discovery_assessment?.assessment?.pipeline_status ?? "not assessed"}

Score this specific program. Vary scores based on evidence quality — identical inputs should not always yield the same number.`;
}

function payloadToBreakdown(
  payload: ConfidencePayload
): ProgramTrustBreakdown {
  const overall = round4(clamp01(payload.overall));
  return {
    overall,
    funnel_coverage: round4(clamp01(payload.funnel_coverage)),
    evidence_strength: round4(clamp01(payload.evidence_strength)),
    biology_signal: round4(clamp01(payload.biology_signal)),
    label: payload.label ?? trustLabelFromOverall(overall),
    rationale: payload.rationale?.trim() || undefined,
    assessment_source: "llm",
  };
}

export async function programConfidenceAgent(
  obj: OpportunityObject,
  phase: "phase1_complete" | "phase2_complete"
): Promise<ProgramTrustBreakdown> {
  const ctx = await loadPhase1Context(obj);
  const cohort = await resolveCohort(ctx);
  const cohortBlock = formatCohortBlock(cohort);
  const top = selectivityTop(ctx.hypotheses ?? []);

  const payload = await callAgentJson<ConfidencePayload>(
    SYSTEM,
    buildUserPrompt(ctx, cohortBlock, phase),
    { temperature: 0.3 }
  );

  const breakdown = payloadToBreakdown(payload);

  for (const entry of payload.hypothesis_confidences ?? []) {
    if (!entry.hypothesis_id) continue;
    const hyp = top.find((h) => h.id === entry.hypothesis_id);
    if (!hyp) continue;
    await updateHypothesis(entry.hypothesis_id, {
      confidence_score: round4(clamp01(entry.confidence)),
    });
  }

  return breakdown;
}

export async function assessProgramConfidence(input: {
  obj: OpportunityObject;
  phase: "phase1_complete" | "phase2_complete";
}): Promise<ProgramTrustBreakdown> {
  try {
    return await programConfidenceAgent(input.obj, input.phase);
  } catch (err) {
    console.warn(
      "[assessProgramConfidence] LLM assessment failed, using formula fallback:",
      err
    );
    const formula = computeProgramTrustScore({
      hypotheses: input.obj.hypotheses ?? [],
      expert_domains: input.obj.expert_domains,
      cd2_associations: input.obj.cd2_associations,
    });
    return {
      ...formula,
      rationale:
        "Confidence derived from funnel coverage and mechanistic chain metrics (LLM assessment unavailable).",
      assessment_source: "formula",
    };
  }
}
