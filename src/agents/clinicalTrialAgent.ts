import type { OpportunityObject } from "@/types/OpportunityObject";
import { callAgentJson } from "@/api/anthropic";
import {
  getTrialCount,
  searchTrialsByTerm,
} from "@/api/clinicalTrials";
import type { Trial } from "@/types/api";
import { getPubMedCount } from "@/api/pubmed";
import { insertEvidenceCard, getAllEvidenceCards } from "@/lib/db";
import { extractKeywords } from "@/lib/hypothesis";
import { ApiError } from "@/lib/http";
import { searchFDAApprovals } from "@/api/openFda";
import { searchPatents } from "@/api/lens";
import {
  findTargetListCard,
  parseRankedTargetsFromCard,
  type RankedTarget,
} from "@/lib/targetList";

const TRIAL_TERMS_SYSTEM = `You are the Clinical Trial Agent for Opportunity Space, built by Arclight Bio.
Generate ClinicalTrials.gov search terms for a biomedical hypothesis.
Respond with valid JSON only — a JSON array of strings.`;

const TRIAL_RELEVANCE_SYSTEM = `You are a relevance filter for a biomedical discovery system built by Arclight Bio.
Return valid JSON only — a JSON array of relevant clinical trials.`;

interface FilteredTrial {
  nctId: string;
  title?: string;
}

export function trialCountScore(relevantCount: number): number {
  if (relevantCount === 0) return 0.2;
  if (relevantCount <= 2) return 0.4;
  if (relevantCount <= 5) return 0.6;
  if (relevantCount <= 15) return 0.75;
  return 0.9;
}

export function parseTrialPhaseScore(phase: string): number {
  const normalized = phase.toUpperCase();

  if (
    normalized.includes("PHASE3") ||
    normalized.includes("PHASE4") ||
    normalized.includes("APPROVED")
  ) {
    return 1.0;
  }
  if (normalized.includes("PHASE2")) return 0.75;
  if (normalized.includes("PHASE1") && !normalized.includes("EARLY")) return 0.45;
  if (
    normalized.includes("EARLY") ||
    normalized.includes("PHASE0") ||
    normalized.includes("FEASIBILITY")
  ) {
    return 0.25;
  }
  return 0.2;
}

export function highestTrialPhaseScore(trials: Trial[]): number {
  if (trials.length === 0) return 0.2;
  return Math.max(...trials.map((trial) => parseTrialPhaseScore(trial.phase)));
}

export function computeClinicalTrialCardScore(
  relevantTrials: Trial[]
): number {
  const countScore = trialCountScore(relevantTrials.length);
  const phaseScore = highestTrialPhaseScore(relevantTrials);
  return countScore * 0.6 + phaseScore * 0.4;
}

export async function filterRelevantTrials(
  trials: Trial[],
  hypothesis: OpportunityObject["hypothesis"]
): Promise<Trial[]> {
  if (trials.length === 0) return [];

  const trialsJson = JSON.stringify(
    trials.map((trial) => ({
      nctId: trial.nctId,
      title: trial.title,
      phase: trial.phase,
      status: trial.status,
      condition: trial.condition,
      intervention: trial.intervention,
    }))
  );

  const userPrompt = `You are a relevance filter for a biomedical discovery system.

The current hypothesis is: ${hypothesis.statement}

Patient population: ${hypothesis.patient_population}
Unmet need: ${hypothesis.unmet_need}

The following clinical trials were retrieved because they matched broad search terms. For each trial, determine: is this trial genuinely relevant to the specific hypothesis above, or does it merely match a disease keyword in an unrelated context (e.g. general ALS trials when the hypothesis is about a specific exosomal microRNA diagnostic)?

Trials: ${trialsJson}

Return only trials directly relevant to this specific hypothesis. Return as JSON array with at least nctId and title for each relevant trial. If none are relevant, return an empty array.`;

  try {
    const filtered = await callAgentJson<FilteredTrial[]>(
      TRIAL_RELEVANCE_SYSTEM,
      userPrompt
    );
    if (!Array.isArray(filtered) || filtered.length === 0) return [];

    const relevantIds = new Set(
      filtered.map((trial) => trial.nctId.toUpperCase())
    );
    return trials.filter((trial) => relevantIds.has(trial.nctId.toUpperCase()));
  } catch {
    return [];
  }
}

async function generateTrialSearchTerms(
  obj: OpportunityObject
): Promise<string[]> {
  const fallbackQuery =
    obj.search_query ?? obj.hypothesis.statement.slice(0, 120);

  try {
    const terms = await callAgentJson<string[]>(
      TRIAL_TERMS_SYSTEM,
      `Given this hypothesis: ${obj.hypothesis.statement}
Generate 3-5 ClinicalTrials.gov search terms that would find relevant trials. Include both the specific mechanism terms and the broader disease/drug terms.

For example, for 'cardiac fibrosis ATTR amyloidosis':
terms = ['transthyretin amyloidosis', 'ATTR cardiomyopathy', 'tafamidis', 'TTR stabilizer', 'amyloid cardiomyopathy']

Return as JSON array of strings.`
    );

    const cleaned = (Array.isArray(terms) ? terms : [])
      .map((term) => term.trim())
      .filter(Boolean);

    if (cleaned.length > 0) return cleaned.slice(0, 5);
  } catch {
    // fall through to keyword fallback
  }

  const { conditions, interventions } = extractKeywords(
    obj.search_query ?? "",
    obj.hypothesis
  );
  const keywordTerms = [...conditions, ...interventions, fallbackQuery].filter(
    Boolean
  );
  return Array.from(new Set(keywordTerms)).slice(0, 5);
}

function dedupeTrials(trials: Trial[]): Trial[] {
  const byNct = new Map<string, Trial>();
  for (const trial of trials) {
    if (!byNct.has(trial.nctId)) {
      byNct.set(trial.nctId, trial);
    }
  }
  return Array.from(byNct.values());
}

interface NoveltyVerdict {
  is_first_in_class: boolean;
  confidence: number;
  verdict: "confirmed" | "likely" | "uncertain" | "not_first_in_class";
  prior_art_found: string[];
  differentiation_angle: string;
  novelty_statement: string;
  target?: string;
}

const NOVELTY_SYSTEM = `You are a first-in-class assessment expert for drug discovery.
Return valid JSON only.`;

async function firstInClassNoveltyCheck(
  obj: OpportunityObject,
  targets: RankedTarget[]
): Promise<NoveltyVerdict[]> {
  if (targets.length === 0) return [];

  const topTargets = targets.slice(0, 3);
  const verdicts: NoveltyVerdict[] = [];

  for (const target of topTargets) {
    const gene = target.gene_symbol;
    const indication = obj.hypothesis.patient_population;

    const [fdaResult, trialResult, patentResult] = await Promise.allSettled([
      searchFDAApprovals(gene, indication),
      searchTrialsByTerm(`${gene} ${indication}`, 10, false),
      searchPatents(`${target.target_name} ${indication}`, 5),
    ]);

    const fdaApprovals =
      fdaResult.status === "fulfilled" ? fdaResult.value : [];
    const activeTrials =
      trialResult.status === "fulfilled" ? trialResult.value : [];
    const patents =
      patentResult.status === "fulfilled" ? patentResult.value : [];

    const recruitingTrials = activeTrials.filter((t) =>
      /RECRUITING|ACTIVE|NOT_YET_RECRUITING/i.test(t.status)
    );

    try {
      const verdict = await callAgentJson<NoveltyVerdict>(
        NOVELTY_SYSTEM,
        `Assess first-in-class status for target ${target.target_name} (${gene}) in indication ${indication}.

FDA approvals found: ${JSON.stringify(fdaApprovals.slice(0, 5))}
Active trials found: ${recruitingTrials.length} (${recruitingTrials.slice(0, 3).map((t) => t.title).join("; ")})
Patents found: ${patents.length} (${patents.slice(0, 3).map((p) => p.title).join("; ")})

Return:
{
  "is_first_in_class": boolean,
  "confidence": number,
  "verdict": "confirmed" | "likely" | "uncertain" | "not_first_in_class",
  "prior_art_found": string[],
  "differentiation_angle": string,
  "novelty_statement": string
}`
      );
      verdicts.push({ ...verdict, target: gene });
    } catch {
      verdicts.push({
        is_first_in_class: recruitingTrials.length === 0 && fdaApprovals.length === 0,
        confidence: 0.5,
        verdict:
          recruitingTrials.length > 2 ? "not_first_in_class" : "uncertain",
        prior_art_found: [
          ...fdaApprovals.map((a) => a.brandName),
          ...recruitingTrials.slice(0, 2).map((t) => t.title),
        ],
        differentiation_angle: "Further differentiation analysis required.",
        novelty_statement: `${gene} in ${indication}: automated partial assessment.`,
        target: gene,
      });
    }
  }

  return verdicts;
}

function formatNoveltyVerdict(verdicts: NoveltyVerdict[]): string {
  return verdicts
    .map(
      (v) =>
        `${v.target}: First-in-class ${v.verdict.toUpperCase()} (confidence ${(v.confidence * 100).toFixed(0)}%) — ${v.novelty_statement}${v.prior_art_found.length ? ` Prior art: ${v.prior_art_found.slice(0, 2).join("; ")}.` : ""}`
    )
    .join("\n");
}

export async function clinicalTrialAgent(obj: OpportunityObject): Promise<void> {
  const includeCompleted = obj.mode === "depth";
  const perTermLimit = obj.mode === "depth" ? 12 : 8;
  const searchTerms = await generateTrialSearchTerms(obj);

  let trials: Trial[] = [];
  let partial = false;

  for (const term of searchTerms) {
    try {
      const results = await searchTrialsByTerm(
        term,
        perTermLimit,
        includeCompleted
      );
      trials = dedupeTrials([...trials, ...results]);
    } catch (err) {
      partial = true;
      if (!(err instanceof ApiError)) throw err;
    }
  }

  const relevantTrials = await filterRelevantTrials(trials, obj.hypothesis);
  const primaryCondition = searchTerms[0] ?? obj.search_query ?? "";

  let paperCount = 0;
  let trialCount = trials.length;
  try {
    paperCount = await getPubMedCount(primaryCondition);
    if (trialCount === 0) {
      trialCount = await getTrialCount(primaryCondition);
    }
  } catch {
    partial = true;
  }

  const ratio = trialCount > 0 ? paperCount / trialCount : paperCount;
  const gapFlag = ratio > 10 && paperCount > 20;

  const trialSummary = relevantTrials
    .slice(0, 8)
    .map(
      (t) =>
        `${t.nctId}: ${t.title} | Phase ${t.phase} | ${t.status} | N=${t.enrollment}`
    )
    .join("\n");

  const recruitingCount = relevantTrials.filter((t) =>
    t.status.includes("RECRUITING")
  ).length;

  const countScore = trialCountScore(relevantTrials.length);
  const phaseScore = highestTrialPhaseScore(relevantTrials);
  const cardScore = computeClinicalTrialCardScore(relevantTrials);

  const content =
    relevantTrials.length === 0
      ? `Clinical trial landscape: ${trials.length} trials retrieved across ${searchTerms.length} search terms, but none matched this specific hypothesis after relevance filtering — early-stage signal.`
      : gapFlag
        ? `Clinical trial gap detected: ${paperCount} papers vs ${trialCount} broad trials (ratio ${ratio.toFixed(1)}:1). ${relevantTrials.length} hypothesis-relevant trial${relevantTrials.length === 1 ? "" : "s"} (${recruitingCount} recruiting).`
        : `Competitive trial landscape: ${relevantTrials.length} hypothesis-relevant trial${relevantTrials.length === 1 ? "" : "s"} of ${trials.length} retrieved (${searchTerms.slice(0, 3).join(", ")}). ${recruitingCount} actively recruiting.`;

  const quality = {
    sample_size: countScore,
    study_design: phaseScore,
    source_credibility: 0.9,
    replication: relevantTrials.length > 3 ? 0.75 : 0.5,
    recency: 0.8,
    composite: cardScore,
  };

  await insertEvidenceCard(obj.id, {
    content: content + (partial ? " [Partial search — some sources unavailable]" : ""),
    source_url:
      relevantTrials[0]?.source_url ??
      trials[0]?.source_url ??
      `https://clinicaltrials.gov/search?term=${encodeURIComponent(primaryCondition)}`,
    source_type: "clinicaltrials",
    contributing_agent: "clinical_trial",
    quality_scores: quality,
    regulatory_weight: cardScore,
    raw_source_metadata: {
      trials: relevantTrials.slice(0, 10),
      allTrials: trials.slice(0, 10),
      trialSummary,
      searchTerms,
      uniqueTrialCount: trials.length,
      relevantTrialCount: relevantTrials.length,
      relevant_trial_count: relevantTrials.length,
      activeTrialCount: recruitingCount,
      trialCountScore: countScore,
      phaseScore,
      cardScore,
      paperCount,
      trialCount,
      ratio,
      gapFlag,
      partial,
    },
  });

  const allCards = await getAllEvidenceCards(obj.id);
  const targetListCard = findTargetListCard(allCards);
  const rankedTargets = parseRankedTargetsFromCard(targetListCard);

  if (rankedTargets.length > 0) {
    const noveltyVerdicts = await firstInClassNoveltyCheck(obj, rankedTargets);
    if (noveltyVerdicts.length > 0) {
      const avgConfidence =
        noveltyVerdicts.reduce((s, v) => s + v.confidence, 0) /
        noveltyVerdicts.length;

      await insertEvidenceCard(obj.id, {
        content: `FIRST-IN-CLASS NOVELTY CHECK\n${formatNoveltyVerdict(noveltyVerdicts)}`,
        source_url: "",
        source_type: "clinicaltrials",
        contributing_agent: "clinical_trial",
        is_novelty_check: true,
        quality_scores: {
          sample_size: 0.6,
          study_design: 0.7,
          source_credibility: 0.85,
          replication: 0.5,
          recency: 0.9,
          composite: avgConfidence,
        },
        regulatory_weight: avgConfidence,
        raw_source_metadata: {
          novelty_verdicts: noveltyVerdicts,
          partial,
        },
      });
    }
  }
}
