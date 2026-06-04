import type {
  AgentName,
  DeriskRecommendation,
  EvidenceCard,
  OpportunityObject,
  QualityScores,
} from "@/types/OpportunityObject";
import { getAllEvidenceCards, getChallengeCount, insertEvidenceCard } from "@/lib/db";
import { refreshScores } from "@/lib/blackboard";
import { computeCompositeQuality } from "@/lib/scoring";
import { callAgentJson } from "@/api/anthropic";
import { getIndicationRiskWeights } from "@/lib/indicationRisk";
import {
  detectSampleSize as scoreSampleSizeFromContent,
  detectStudyDesign as scoreStudyDesignFromContent,
} from "@/lib/evidenceQuality";

const CHALLENGE_THRESHOLD = 0.65;
const MAX_CHALLENGES = 3;

const DERISK_SYSTEM = `You are a regulatory strategy expert for drug development.
Use standard clinical trial language: Phase 1/2/3, primary endpoint, inclusion/exclusion-aligned population, biomarker names.
Describe interventions by modality and mechanism, not bare target approval.
Return valid JSON only.`;

async function generateDeriskRecommendation(
  obj: OpportunityObject,
  gapContent: string
): Promise<DeriskRecommendation | null> {
  const weights = getIndicationRiskWeights(obj.indication_type);
  try {
    return await callAgentJson<DeriskRecommendation>(
      DERISK_SYSTEM,
      `A gap has been identified in the evidence for this hypothesis:

Hypothesis: ${obj.hypothesis.statement}
Gap: ${gapContent}
Indication type: ${obj.indication_type ?? "oncology"}
Safety weight: ${weights.safety_weight}, Efficacy weight: ${weights.efficacy_weight}

Generate a specific de-risking study recommendation:
{
  "study_type": string,
  "primary_objective": string,
  "patient_population": string,
  "n_required": integer,
  "primary_endpoint": string,
  "biomarkers_of_efficacy": string[],
  "biomarkers_of_safety": string[],
  "estimated_timeline": string,
  "estimated_cost_range": string,
  "closes_gap": string
}`
    );
  } catch {
    return null;
  }
}

function extractSampleSize(metadata: Record<string, unknown>): number | null {
  if (typeof metadata.sample_size === "number") return metadata.sample_size;
  const content = JSON.stringify(metadata);
  const match = content.match(/\bn\s*[=:]\s*(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

function detectStudyDesign(content: string): string {
  const lower = content.toLowerCase();
  if (lower.includes("rct") || lower.includes("randomized")) return "rct";
  if (lower.includes("meta-analysis")) return "meta_analysis";
  if (lower.includes("systematic review")) return "systematic_review";
  if (lower.includes("clinical trial") || lower.includes("cohort"))
    return "prospective_cohort";
  if (lower.includes("retrospective")) return "retrospective";
  if (lower.includes("case report")) return "case_report";
  if (lower.includes("observational")) return "observational";
  return "observational";
}

function formatStudyDesign(design: string): string {
  const labels: Record<string, string> = {
    rct: "RCT",
    meta_analysis: "Meta-analysis",
    systematic_review: "Systematic review",
    prospective_cohort: "Prospective cohort",
    retrospective: "Retrospective",
    observational: "Observational",
    case_report: "Case report",
  };
  return labels[design] ?? design;
}

function scoreSampleSize(n: number | null): number {
  if (n === null) return 0.5;
  if (n < 30) return 0.2;
  if (n < 200) return 0.6;
  return 1.0;
}

function scoreStudyDesign(design: string): number {
  const scores: Record<string, number> = {
    rct: 1.0,
    meta_analysis: 1.0,
    systematic_review: 0.95,
    prospective_cohort: 0.75,
    retrospective: 0.5,
    observational: 0.4,
    case_report: 0.2,
  };
  return scores[design] ?? 0.4;
}

function scoreSourceCredibility(card: EvidenceCard): number {
  const journal = (card.raw_source_metadata?.journal as string) ?? "";
  if (card.raw_source_metadata?.partial) return 0.45;
  if (card.raw_source_metadata?.lensMissing) return 0.5;
  if (journal.toLowerCase().includes("biorxiv")) return 0.6;
  if (card.source_type === "pubmed") return 0.85;
  if (card.source_type === "clinicaltrials") return 0.9;
  if (card.source_type === "opentargets") return 0.85;
  return 0.7;
}

function conceptuallyOverlaps(a: string, b: string): boolean {
  const wordsA = new Set(
    a.toLowerCase().split(/\W+/).filter((w) => w.length > 4)
  );
  const wordsB = b.toLowerCase().split(/\W+/).filter((w) => w.length > 4);
  return wordsB.filter((w) => wordsA.has(w)).length >= 2;
}

function scoreReplication(card: EvidenceCard, allCards: EvidenceCard[]): number {
  const confirmations = allCards.filter(
    (other) =>
      other.id !== card.id &&
      !other.is_challenge &&
      conceptuallyOverlaps(other.content, card.content)
  ).length;
  if (confirmations === 0) return 0.4;
  if (confirmations === 1) return 0.75;
  return 1.0;
}

function scoreRecency(card: EvidenceCard): number {
  const year =
    (card.raw_source_metadata?.year as number) ??
    new Date(card.timestamp).getFullYear();
  const ageYears = new Date().getFullYear() - year;
  return Math.max(0.2, 1.0 - ageYears * 0.08);
}

function weakestDimension(
  scores: QualityScores
): { dimension: keyof QualityScores; value: number } {
  const entries = (
    Object.entries(scores).filter(([k]) => k !== "composite") as [
      keyof QualityScores,
      number,
    ][]
  ).sort((a, b) => a[1] - b[1]);
  return { dimension: entries[0][0], value: entries[0][1] };
}

function agentChallengePriority(agent: AgentName): number {
  switch (agent) {
    case "literature":
      return 0;
    case "rwe_signal":
      return 1;
    case "commercial":
      return 2;
    default:
      return 3;
  }
}

function dimensionFailureMessage(
  dimension: keyof QualityScores,
  scores: QualityScores,
  card: EvidenceCard
): string | null {
  if (dimension === "composite") return null;

  const value = scores[dimension];
  if (value >= CHALLENGE_THRESHOLD) return null;

  switch (dimension) {
    case "sample_size": {
      const n = extractSampleSize(card.raw_source_metadata);
      if (n !== null && n < 30) {
        return `Sample size inadequate (N=${n}, threshold N=30)`;
      }
      if (n === null) {
        return "Sample size unreported — insufficient for regulatory confidence";
      }
      return `Sample size score inadequate (${value.toFixed(2)})`;
    }
    case "study_design": {
      const design =
        (card.raw_source_metadata?.study_design as string) ??
        detectStudyDesign(card.content);
      if (["observational", "case_report", "retrospective"].includes(design)) {
        return `${formatStudyDesign(design)} study design limits causal inference`;
      }
      return `Study design (${formatStudyDesign(design)}) below regulatory threshold (${value.toFixed(2)})`;
    }
    case "source_credibility": {
      if (card.raw_source_metadata?.partial) {
        return "Source credibility reduced — partial search results";
      }
      if (card.raw_source_metadata?.lensMissing) {
        return "Source credibility reduced — patent data unavailable";
      }
      const journal = (card.raw_source_metadata?.journal as string) ?? "";
      if (journal.toLowerCase().includes("biorxiv")) {
        return "Source credibility limited — preprint not peer-reviewed";
      }
      return `Source credibility below threshold (${value.toFixed(2)})`;
    }
    case "replication":
      return "Replication insufficient — no corroborating evidence from other agents";
    case "recency": {
      const year =
        (card.raw_source_metadata?.year as number) ??
        new Date(card.timestamp).getFullYear();
      return `Recency below threshold — evidence from ${year} may be outdated (${value.toFixed(2)})`;
    }
    default:
      return null;
  }
}

function buildChallengeContent(
  card: EvidenceCard,
  scores: QualityScores,
  scoreImpact: number
): string {
  const failingMessages = (
    Object.keys(scores) as (keyof QualityScores)[]
  )
    .filter((k) => k !== "composite" && scores[k] < CHALLENGE_THRESHOLD)
    .sort((a, b) => scores[a] - scores[b])
    .map((k) => dimensionFailureMessage(k, scores, card))
    .filter((msg): msg is string => msg !== null);

  if (failingMessages.length === 0) {
    const weak = weakestDimension(scores);
    failingMessages.push(
      `${weak.dimension.replace(/_/g, " ")} below threshold (${weak.value.toFixed(2)})`
    );
  }

  const impactPct = (scoreImpact * 100).toFixed(1);
  return `${failingMessages.join(". ")}. Score impact: -${impactPct}% confidence.`;
}

function computeScoreImpact(composite: number): number {
  return Math.max(0.04, 0.05 + (CHALLENGE_THRESHOLD - composite) * 0.25);
}

function auditCard(
  card: EvidenceCard,
  allCards: EvidenceCard[],
  fullAudit: boolean
): QualityScores {
  const bracketContent = card.content.match(/^\[/) ? card.content : null;
  const sampleSizeMeta = extractSampleSize(card.raw_source_metadata);
  const designMeta =
    (card.raw_source_metadata?.study_design as string) ??
    detectStudyDesign(card.content);

  const scores: QualityScores = {
    sample_size: bracketContent
      ? scoreSampleSizeFromContent(card.content)
      : scoreSampleSize(sampleSizeMeta),
    study_design: bracketContent
      ? scoreStudyDesignFromContent(card.content)
      : scoreStudyDesign(designMeta),
    source_credibility: scoreSourceCredibility(card),
    replication: fullAudit ? scoreReplication(card, allCards) : 0.4,
    recency: fullAudit ? scoreRecency(card) : 0.7,
    composite: 0,
  };
  scores.composite = computeCompositeQuality(scores);
  return scores;
}

interface AuditedCard {
  card: EvidenceCard;
  scores: QualityScores;
}

async function postChallenge(
  obj: OpportunityObject,
  card: EvidenceCard,
  scores: QualityScores,
  challenge: {
    content: string;
    dimension: keyof QualityScores;
    score_impact: number;
  },
  phase: string
): Promise<void> {
  const count = await getChallengeCount(obj.id);
  if (count >= MAX_CHALLENGES) return;

  const derisk = await generateDeriskRecommendation(obj, challenge.content);

  await insertEvidenceCard(obj.id, {
    content: challenge.content,
    source_url: card.source_url,
    source_type: "fda",
    contributing_agent: "regulatory",
    quality_scores: scores,
    regulatory_weight: scores.composite,
    raw_source_metadata: {
      audited_card_id: card.id,
      audit_scores: scores,
      phase,
    },
    is_challenge: true,
    challenge_metadata: {
      evidence_card_ref: card.id,
      score_impact: challenge.score_impact,
      dimension: challenge.dimension,
    },
    derisk_recommendation: derisk ?? undefined,
  });
}

async function postCapReachedSummary(
  obj: OpportunityObject,
  cardsReviewed: number,
  avgQuality: number,
  phase: string
): Promise<void> {
  await insertEvidenceCard(obj.id, {
    content: `Regulatory audit complete. ${cardsReviewed} additional cards reviewed. Average quality: ${avgQuality.toFixed(2)}. Challenge cap reached — see existing challenges.`,
    source_url: "",
    source_type: "fda",
    contributing_agent: "regulatory",
    quality_scores: {
      sample_size: 0.8,
      study_design: 0.8,
      source_credibility: 0.9,
      replication: 0.7,
      recency: 0.8,
      composite: 0.8,
    },
    regulatory_weight: 0.8,
    raw_source_metadata: {
      phase,
      cardsReviewed,
      challengeCapReached: true,
    },
  });
}

async function postFullAuditSummary(
  obj: OpportunityObject,
  evidenceCards: EvidenceCard[],
  fullAudit: boolean,
  phase: string,
  challengesPosted: number
): Promise<void> {
  const avgComposite =
    evidenceCards.reduce((sum, c) => sum + c.quality_scores.composite, 0) /
    evidenceCards.length;

  await insertEvidenceCard(obj.id, {
    content: `Regulatory audit complete (${fullAudit ? "full five-dimension" : "sample size + study design"} pass). ${evidenceCards.length} cards reviewed. Average evidence quality: ${avgComposite.toFixed(2)}.`,
    source_url: "",
    source_type: "fda",
    contributing_agent: "regulatory",
    quality_scores: {
      sample_size: 0.8,
      study_design: 0.8,
      source_credibility: 0.9,
      replication: 0.7,
      recency: 0.8,
      composite: 0.8,
    },
    regulatory_weight: 0.8,
    raw_source_metadata: {
      phase,
      cardsReviewed: evidenceCards.length,
      fullAudit,
      challengesPosted,
    },
  });
}

export async function regulatoryAgentForCards(
  obj: OpportunityObject,
  cardIds: string[]
): Promise<void> {
  const challengeCount = await getChallengeCount(obj.id);
  if (challengeCount >= MAX_CHALLENGES) {
    await refreshScores(obj.id);
    return;
  }

  const allCards = await getAllEvidenceCards(obj.id);
  const allEvidence = allCards.filter(
    (c) => !c.is_challenge && c.contributing_agent !== "regulatory"
  );
  const evidenceCards = allEvidence.filter((c) => cardIds.includes(c.id));

  if (evidenceCards.length === 0) return;

  const fullAudit = obj.mode !== "speed";
  const result = await challengeWeakestCards(
    obj,
    evidenceCards,
    allEvidence,
    fullAudit,
    "surveillance"
  );

  if (result.capReached) {
    await postCapReachedSummary(
      obj,
      result.cardsReviewed,
      result.avgAuditedQuality,
      "surveillance"
    );
  }
}

export async function regulatoryAgent(
  obj: OpportunityObject,
  phase: "early" | "full" = "full"
): Promise<void> {
  const challengeCount = await getChallengeCount(obj.id);
  if (challengeCount >= MAX_CHALLENGES) {
    await refreshScores(obj.id);
    return;
  }

  const allCards = await getAllEvidenceCards(obj.id);
  const evidenceCards = allCards.filter(
    (c) => !c.is_challenge && c.contributing_agent !== "regulatory"
  );

  if (evidenceCards.length === 0) return;

  const fullAudit = phase === "full" && obj.mode !== "speed";
  const result = await challengeWeakestCards(
    obj,
    evidenceCards,
    evidenceCards,
    fullAudit,
    phase
  );

  if (phase === "full") {
    if (result.capReached) {
      await postCapReachedSummary(
        obj,
        result.cardsReviewed,
        result.avgAuditedQuality,
        phase
      );
    } else {
      await postFullAuditSummary(
        obj,
        evidenceCards,
        fullAudit,
        phase,
        result.challenged
      );
    }
  }
}

interface ChallengeRunResult {
  challenged: number;
  capReached: boolean;
  cardsReviewed: number;
  avgAuditedQuality: number;
}

async function challengeWeakestCards(
  obj: OpportunityObject,
  cardsToAudit: EvidenceCard[],
  replicationContext: EvidenceCard[],
  fullAudit: boolean,
  phase: string
): Promise<ChallengeRunResult> {
  const existingChallengeCount = await getChallengeCount(obj.id);
  const remainingSlots = Math.max(0, MAX_CHALLENGES - existingChallengeCount);
  const capReached = existingChallengeCount >= MAX_CHALLENGES;

  const auditedCards: AuditedCard[] = cardsToAudit.map((card) => ({
    card,
    scores: auditCard(card, replicationContext, fullAudit),
  }));

  const avgAuditedQuality =
    auditedCards.length > 0
      ? auditedCards.reduce((sum, item) => sum + item.scores.composite, 0) /
        auditedCards.length
      : 0;

  const eligible = auditedCards
    .filter(({ scores }) => scores.composite < CHALLENGE_THRESHOLD)
    .sort((a, b) => {
      const priorityDiff =
        agentChallengePriority(a.card.contributing_agent) -
        agentChallengePriority(b.card.contributing_agent);
      if (priorityDiff !== 0) return priorityDiff;
      return a.scores.composite - b.scores.composite;
    });

  const cardsToChallenge = capReached
    ? []
    : eligible.slice(0, remainingSlots);

  if (capReached) {
    await refreshScores(obj.id);
  }

  for (const { card, scores } of cardsToChallenge) {
    const weak = weakestDimension(scores);
    const scoreImpact = computeScoreImpact(scores.composite);

    await postChallenge(
      obj,
      card,
      scores,
      {
        content: buildChallengeContent(card, scores, scoreImpact),
        dimension: weak.dimension,
        score_impact: scoreImpact,
      },
      phase
    );
  }

  return {
    challenged: cardsToChallenge.length,
    capReached,
    cardsReviewed: cardsToAudit.length,
    avgAuditedQuality,
  };
}
