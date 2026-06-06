import { callAgentJson } from "@/api/anthropic";
import {
  getOpportunityObject,
  getEvidenceCardsForHypothesis,
  updateOpportunityObject,
  getOrgContext,
  listHypotheses,
} from "@/lib/db";
import { computePortfolioFit } from "@/lib/portfolioFit";
import { pickTopHypothesis, applyTopHypothesisScores } from "@/lib/hypothesisRanking";
import { buildCompetitiveLandscape } from "@/lib/competitiveLandscape";
import { auditInterventionDirection } from "@/lib/interventionDirection";
import type {
  DeriskRecommendation,
  EvidenceCard,
  HypothesisRecord,
  OutgroupValidation,
} from "@/types/OpportunityObject";
import type {
  DecisionBrief,
  DecisionRecommendation,
  DecisionBriefBiomarkers,
  DecisionBriefDiseaseModel,
} from "@/types/DecisionBrief";

const SYNTHESIS_SYSTEM = `You are a pharmaceutical portfolio strategist producing a board-ready decision brief from live discovery evidence.
Use standard clinical language. Distinguish targets from drugs/modalities. Cite evidence by card ID in evidence_card_ids arrays.
If mechanistic chain confidence is below 0.4 or target-hypothesis mismatch exists, do not recommend pursue.
Return valid JSON only matching the requested schema.`;

interface SynthesisPayload {
  recommendation: DecisionRecommendation;
  recommendation_rationale: string;
  tpp: { minimum: string; base: string; aspirational: string };
  differentiation: string;
  critical_risks: Array<{
    risk: string;
    severity: "high" | "medium";
    evidence_card_ids: string[];
  }>;
  next_proof_point: {
    study_type: string;
    primary_endpoint: string;
    n_required: number;
    estimated_timeline: string;
    estimated_cost_range: string;
    closes_gap: string;
  };
  hypothesis_ranking_summary: string;
  evidence_card_ids: string[];
  recommended_biomarkers?: {
    efficacy: string[];
    safety: string[];
    engagement: string[];
  };
  recommended_models?: Array<{
    model: string;
    rationale: string;
    evidence_card_ids: string[];
  }>;
}

function capRecommendation(
  rec: DecisionRecommendation,
  validation: OutgroupValidation | null | undefined,
  chainConfidence?: number | null,
  targetMismatch?: boolean
): DecisionRecommendation {
  if (validation?.status === "scale_unreliable" && rec === "pursue") {
    return "watch";
  }
  if (targetMismatch && rec === "pursue") return "watch";
  if (chainConfidence != null && chainConfidence < 0.4 && rec === "pursue") {
    return "watch";
  }
  return rec;
}

function collectDeriskPlans(cards: EvidenceCard[]): DeriskRecommendation[] {
  const seen = new Set<string>();
  const plans: DeriskRecommendation[] = [];
  for (const c of cards) {
    if (!c.is_challenge || !c.derisk_recommendation) continue;
    const key = c.derisk_recommendation.study_type;
    if (seen.has(key)) continue;
    seen.add(key);
    plans.push(c.derisk_recommendation);
    if (plans.length >= 3) break;
  }
  return plans;
}

function collectBiomarkersFromDerisk(
  deriskPlans: DeriskRecommendation[]
): DecisionBriefBiomarkers {
  const efficacy = new Set<string>();
  const safety = new Set<string>();
  for (const p of deriskPlans) {
    for (const b of p.biomarkers_of_efficacy ?? []) efficacy.add(b);
    for (const b of p.biomarkers_of_safety ?? []) safety.add(b);
  }
  return {
    efficacy: Array.from(efficacy).slice(0, 8),
    safety: Array.from(safety).slice(0, 6),
    engagement: [],
  };
}

function buildHypothesisBlock(
  h: HypothesisRecord,
  cards: EvidenceCard[],
  rank: number | null
): string {
  const cardSummaries = cards
    .slice(0, 12)
    .map(
      (c) =>
        `[${c.id}] (${c.contributing_agent}) ${c.content.slice(0, 180)}`
    )
    .join("\n");

  const chainSummary = h.mechanistic_chain
    ? `Chain confidence: ${(h.mechanistic_chain.overall_chain_confidence * 100).toFixed(0)}%; gaps: ${h.mechanistic_chain.gaps.slice(0, 2).join("; ")}`
    : "No mechanistic chain";

  const alignSummary = h.target_alignment
    ? `Target alignment: ${h.target_alignment.status} — ${h.target_alignment.message}`
    : "";

  return `### Hypothesis rank ${rank ?? "?"}${h.is_outgroup ? " [OUTGROUP]" : ""}
ID: ${h.id}
Statement: ${h.statement}
Modality: ${h.declared_modality ?? "unknown"} | Pathway: ${h.regulatory_pathway ?? "unknown"}
Confidence: ${((h.confidence_score ?? 0) * 100).toFixed(1)}% | Zone: ${h.actionability_zone ?? "unknown"}
${chainSummary}
${alignSummary}
Evidence (${cards.length} cards):
${cardSummaries || "(none)"}`;
}

export async function decisionSynthesisAgent(
  opportunityId: string
): Promise<DecisionBrief | null> {
  const obj = await getOpportunityObject(opportunityId);
  if (!obj || obj.schema_version !== 2) return null;

  const hypotheses = await listHypotheses(opportunityId);
  if (hypotheses.length === 0) return null;

  const top =
    hypotheses.find((h) => h.id === obj.top_hypothesis_id) ??
    pickTopHypothesis(hypotheses);
  if (!top) return null;

  const org = await getOrgContext(obj.org_context_id);
  const portfolioFit = computePortfolioFit(top, org);

  const cardsByHyp = new Map<string, EvidenceCard[]>();
  for (const h of hypotheses) {
    cardsByHyp.set(h.id, await getEvidenceCardsForHypothesis(h.id));
  }
  const topCards = cardsByHyp.get(top.id) ?? [];

  const noveltyCard = topCards.find((c) => c.is_novelty_check);
  const competitiveLandscape = await buildCompetitiveLandscape(
    obj.search_query ?? top.statement,
    top.patient_population,
    topCards
  );

  const directionAudit = auditInterventionDirection(top.statement, topCards);

  const hypothesisBlocks = hypotheses
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
    .map((h) => buildHypothesisBlock(h, cardsByHyp.get(h.id) ?? [], h.rank))
    .join("\n\n");

  const userPrompt = `Discovery query: ${obj.search_query ?? obj.hypothesis.statement}
Indication type: ${obj.indication_type ?? "unknown"}
Outgroup calibration: ${obj.outgroup_validation?.status ?? "unknown"} — ${obj.outgroup_validation?.message ?? ""}
Portfolio fit (pre-computed): ${portfolioFit.summary}
Target alignment: ${top.target_alignment?.status ?? "unknown"} — ${top.target_alignment?.message ?? ""}
Mechanistic chain confidence: ${top.mechanistic_chain?.overall_chain_confidence ?? "unknown"}
Chain gaps: ${top.mechanistic_chain?.gaps?.join("; ") ?? "none"}
Score interpretation: ${top.score_decomposition?.interpretation ?? ""}
Novelty/FIC: ${noveltyCard?.content.slice(0, 300) ?? "none"}
Competitive landscape: approved=${competitiveLandscape.approved.length}, active trials=${competitiveLandscape.active.length}, failed=${competitiveLandscape.failed.length}
Interventional direction: claimed ${directionAudit.claimed_direction}, contradiction=${directionAudit.has_contradiction}

Ranked hypotheses:
${hypothesisBlocks}

Top hypothesis for decision: ${top.id}

Produce a decision brief JSON:
{
  "recommendation": "pursue" | "watch" | "kill" | "partner",
  "recommendation_rationale": string (3-5 sentences, evidence-linked),
  "tpp": { "minimum": string, "base": string, "aspirational": string },
  "differentiation": string (vs standard of care and outgroup),
  "critical_risks": [{ "risk": string, "severity": "high"|"medium", "evidence_card_ids": string[] }],
  "next_proof_point": {
    "study_type": string,
    "primary_endpoint": string,
    "n_required": number,
    "estimated_timeline": string,
    "estimated_cost_range": string,
    "closes_gap": string
  },
  "recommended_biomarkers": { "efficacy": string[], "safety": string[], "engagement": string[] },
  "recommended_models": [{ "model": string, "rationale": string, "evidence_card_ids": string[] }],
  "hypothesis_ranking_summary": string,
  "evidence_card_ids": string[] (key cards supporting recommendation)
}

If calibration is scale_unreliable, target mismatch, or chain confidence < 0.4, do not recommend pursue — use watch with explicit uncertainty.`;

  let payload: SynthesisPayload;
  try {
    payload = await callAgentJson<SynthesisPayload>(SYNTHESIS_SYSTEM, userPrompt);
  } catch {
    return null;
  }

  const deriskPlans = collectDeriskPlans(topCards);
  const biomarkersFromDerisk = collectBiomarkersFromDerisk(deriskPlans);

  const recommendation = capRecommendation(
    payload.recommendation,
    obj.outgroup_validation,
    top.mechanistic_chain?.overall_chain_confidence,
    top.target_alignment?.status === "mismatch"
  );

  const brief: DecisionBrief = {
    recommendation,
    recommendation_rationale: payload.recommendation_rationale?.trim() ?? "",
    calibration_caveat:
      obj.outgroup_validation?.status === "scale_unreliable"
        ? obj.outgroup_validation.message
        : top.target_alignment?.status === "mismatch"
          ? top.target_alignment.message
          : undefined,
    top_hypothesis_id: top.id,
    top_hypothesis_statement: top.statement,
    tpp: payload.tpp,
    differentiation: payload.differentiation?.trim() ?? "",
    critical_risks: payload.critical_risks ?? [],
    derisk_plan: deriskPlans,
    next_proof_point: payload.next_proof_point,
    portfolio_fit: portfolioFit,
    hypothesis_ranking_summary:
      payload.hypothesis_ranking_summary?.trim() ?? "",
    evidence_card_ids: payload.evidence_card_ids ?? [],
    generated_at: new Date().toISOString(),
    score_interpretation: top.score_decomposition?.interpretation,
    score_decomposition: top.score_decomposition ?? undefined,
    interventional_direction: directionAudit,
    recommended_biomarkers: {
      efficacy: [
        ...(payload.recommended_biomarkers?.efficacy ?? []),
        ...biomarkersFromDerisk.efficacy,
      ].slice(0, 10),
      safety: [
        ...(payload.recommended_biomarkers?.safety ?? []),
        ...biomarkersFromDerisk.safety,
      ].slice(0, 8),
      engagement: payload.recommended_biomarkers?.engagement ?? [],
    },
    recommended_models: payload.recommended_models ?? [],
    competitive_landscape: competitiveLandscape,
  };

  await updateOpportunityObject(opportunityId, { decision_brief: brief });

  const topRecord = hypotheses.find((h) => h.id === top.id);
  if (topRecord) {
    await updateOpportunityObject(opportunityId, applyTopHypothesisScores(topRecord));
  }

  return brief;
}

/** Cross-hypothesis comparison before ranking (V2-023 stage3 body). */
export async function stage3CrossHypothesisEvaluate(
  opportunityId: string
): Promise<void> {
  const obj = await getOpportunityObject(opportunityId);
  if (!obj || obj.schema_version !== 2) return;

  const hypotheses = await listHypotheses(opportunityId);
  if (hypotheses.length < 2) return;

  const blocks: string[] = [];
  for (const h of hypotheses) {
    const cards = await getEvidenceCardsForHypothesis(h.id);
    blocks.push(
      `${h.is_outgroup ? "[OUTGROUP] " : ""}${h.statement.slice(0, 120)} — ${cards.filter((c) => !c.is_challenge).length} evidence cards, confidence ${((h.confidence_score ?? 0) * 100).toFixed(0)}%`
    );
  }

  await updateOpportunityObject(opportunityId, {
    blackboard_state: {
      ...obj.blackboard_state,
      completedSteps: obj.blackboard_state?.completedSteps ?? [],
      stage3_evaluation_summary: blocks.join("\n"),
    },
  });
}
