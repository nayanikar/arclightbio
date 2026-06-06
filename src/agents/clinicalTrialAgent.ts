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
import { filterFailed, filterOk, type FilterResult } from "@/lib/filterResult";

const TRIAL_TERMS_SYSTEM = `You are the Clinical Trial Agent for Opportunity Space, built by Arclight Bio.
Generate ClinicalTrials.gov search terms for a biomedical hypothesis.
Respond with valid JSON only — a JSON array of strings.`;

const TRIAL_RELEVANCE_SYSTEM = `You are a relevance filter for a biomedical discovery system built by Arclight Bio.
Return valid JSON only — a JSON array of relevant clinical trials.
Trials should be described by intervention class and indication, not bare target approval.`;

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
): Promise<FilterResult<Trial>> {
  if (trials.length === 0) return filterOk([]);

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
    if (!Array.isArray(filtered)) {
      return filterFailed("Trial relevance filter returned invalid response");
    }
    if (filtered.length === 0) return filterOk([]);

    const relevantIds = new Set(
      filtered.map((trial) => trial.nctId.toUpperCase())
    );
    return filterOk(
      trials.filter((trial) => relevantIds.has(trial.nctId.toUpperCase()))
    );
  } catch {
    return filterFailed("Trial relevance filter unavailable");
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
First-in-class means no approved drug with the same mechanism-in-indication; cite prior art as drug names or trial titles, not bare target symbols.
Use hedged language in novelty_statement (e.g. "evidence suggests", "consistent with") unless API data confirm absence of prior art.
In novelty_statement, specify intervention class (e.g. TLR7 agonist) not target approval alone.
Return valid JSON only.`;

function normalizeNoveltyVerdict(
  raw: Partial<NoveltyVerdict> & { target?: string },
  fallbackTarget: string
): NoveltyVerdict {
  const verdict =
    raw.verdict === "confirmed" ||
    raw.verdict === "likely" ||
    raw.verdict === "uncertain" ||
    raw.verdict === "not_first_in_class"
      ? raw.verdict
      : raw.is_first_in_class === true
        ? "likely"
        : raw.is_first_in_class === false
          ? "not_first_in_class"
          : "uncertain";

  return {
    is_first_in_class: Boolean(raw.is_first_in_class),
    confidence:
      typeof raw.confidence === "number" && !Number.isNaN(raw.confidence)
        ? raw.confidence
        : 0.45,
    verdict,
    prior_art_found: Array.isArray(raw.prior_art_found)
      ? raw.prior_art_found.filter(Boolean)
      : [],
    differentiation_angle:
      raw.differentiation_angle?.trim() ||
      "Further differentiation analysis required.",
    novelty_statement:
      raw.novelty_statement?.trim() ||
      `Novelty assessment for ${fallbackTarget} — verdict ${verdict.replace(/_/g, " ")}.`,
    target: raw.target?.trim() || fallbackTarget,
  };
}

async function firstInClassNoveltyCheckForHypothesis(
  obj: OpportunityObject
): Promise<NoveltyVerdict[]> {
  const searchTerm = obj.hypothesis.statement.slice(0, 160);
  const indication = obj.hypothesis.patient_population;

  const [trialResult, patentResult] = await Promise.allSettled([
    searchTrialsByTerm(searchTerm, 10, false),
    searchPatents(`${searchTerm} ${indication}`, 5),
  ]);

  const trialsOk = trialResult.status === "fulfilled";
  const patentsOk = patentResult.status === "fulfilled";
  const activeTrials =
    trialResult.status === "fulfilled" ? trialResult.value : [];
  const patents =
    patentResult.status === "fulfilled" ? patentResult.value : [];

  const recruitingTrials = activeTrials.filter((t) =>
    /RECRUITING|ACTIVE|NOT_YET_RECRUITING/i.test(t.status)
  );

  try {
    const verdict = normalizeNoveltyVerdict(
      await callAgentJson<Partial<NoveltyVerdict>>(
        NOVELTY_SYSTEM,
        `Assess first-in-class / differentiation for this mechanism-level thesis (no ranked target list):
Thesis: ${obj.hypothesis.statement}
Indication: ${indication}

Active trials found: ${recruitingTrials.length} (${recruitingTrials.slice(0, 3).map((t) => t.title).join("; ")})
Patents found: ${patents.length} (${patents.slice(0, 3).map((p) => p.title).join("; ")})

Return same JSON schema with target set to "MECHANISM".`
      ),
      "MECHANISM"
    );
    return [verdict];
  } catch {
    const hasPriorArt = patents.length > 0 || recruitingTrials.length > 2;
    return [
      {
        is_first_in_class: !hasPriorArt,
        confidence: hasPriorArt ? 0.35 : 0.45,
        verdict: hasPriorArt ? "not_first_in_class" : "uncertain",
        prior_art_found: [
          ...patents.slice(0, 2).map((p) => p.title),
          ...recruitingTrials.slice(0, 2).map((t) => t.title),
        ],
        differentiation_angle: "Mechanism-level assessment without ranked targets.",
        novelty_statement: hasPriorArt
          ? `Mechanism thesis: prior art detected in trials/patents — differentiation requires explicit modality or target claim.`
          : `Mechanism thesis: no direct prior art in searched trials/patents; novelty uncertain without target list.`,
        target: "MECHANISM",
      },
    ];
  }
}

async function insertNoveltyCard(
  obj: OpportunityObject,
  noveltyVerdicts: NoveltyVerdict[],
  partial: boolean
): Promise<void> {
  if (noveltyVerdicts.length === 0) return;

  const avgConfidence =
    noveltyVerdicts.reduce((s, v) => s + v.confidence, 0) /
    noveltyVerdicts.length;
  const noveltyAssessmentFailed = noveltyVerdicts.some((v) =>
    (v.novelty_statement ?? "").includes("prior-art search unavailable")
  );

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
      partial: partial || noveltyAssessmentFailed,
      novelty_assessment_failed: noveltyAssessmentFailed,
      mechanism_level: noveltyVerdicts[0]?.target === "MECHANISM",
    },
  });
}

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

    const fdaOk = fdaResult.status === "fulfilled";
    const trialsOk = trialResult.status === "fulfilled";
    const patentsOk = patentResult.status === "fulfilled";

    const fdaApprovals =
      fdaResult.status === "fulfilled" ? fdaResult.value : [];
    const activeTrials =
      trialResult.status === "fulfilled" ? trialResult.value : [];
    const patents =
      patentResult.status === "fulfilled" ? patentResult.value : [];

    const recruitingTrials = activeTrials.filter((t) =>
      /RECRUITING|ACTIVE|NOT_YET_RECRUITING/i.test(t.status)
    );

    const allSourcesOk = fdaOk && trialsOk && patentsOk;

    try {
      const verdict = normalizeNoveltyVerdict(
        await callAgentJson<Partial<NoveltyVerdict>>(
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
        ),
        gene
      );
      verdicts.push(verdict);
    } catch {
      if (!allSourcesOk) {
        verdicts.push({
          is_first_in_class: false,
          confidence: 0.2,
          verdict: "uncertain",
          prior_art_found: [
            ...fdaApprovals.map((a) => a.brandName),
            ...recruitingTrials.slice(0, 2).map((t) => t.title),
          ],
          differentiation_angle: "Further differentiation analysis required.",
          novelty_statement: `${gene} in ${indication}: Novelty assessment incomplete — prior-art search unavailable.`,
          target: gene,
        });
      } else {
        const hasPriorArt =
          fdaApprovals.length > 0 ||
          patents.length > 0 ||
          recruitingTrials.length > 2;
        verdicts.push({
          is_first_in_class:
            !hasPriorArt &&
            recruitingTrials.length === 0 &&
            fdaApprovals.length === 0 &&
            patents.length === 0,
          confidence: hasPriorArt ? 0.35 : 0.5,
          verdict: hasPriorArt ? "not_first_in_class" : "uncertain",
          prior_art_found: [
            ...fdaApprovals.map((a) => a.brandName),
            ...patents.slice(0, 2).map((p) => p.title),
            ...recruitingTrials.slice(0, 2).map((t) => t.title),
          ],
          differentiation_angle: "Further differentiation analysis required.",
          novelty_statement: hasPriorArt
            ? `${gene} in ${indication}: prior art detected in FDA approvals, patents, and/or active trials — not first-in-class.`
            : `${gene} in ${indication}: automated partial assessment — no prior art in searched sources.`,
          target: gene,
        });
      }
    }
  }

  return verdicts;
}

function formatNoveltyVerdict(verdicts: NoveltyVerdict[]): string {
  return verdicts
    .map((v) => {
      const verdictLabel = (v.verdict ?? "uncertain").replace(/_/g, " ");
      const statement = v.novelty_statement ?? "Novelty assessment incomplete.";
      return `${v.target}: first-in-class assessment — ${verdictLabel} (confidence ${((v.confidence ?? 0) * 100).toFixed(0)}%) — ${statement}${v.prior_art_found?.length ? ` Prior art: ${v.prior_art_found.slice(0, 2).join("; ")}.` : ""}`;
    })
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

  const trialFilterResult = await filterRelevantTrials(trials, obj.hypothesis);
  const trialFilterFailed = trialFilterResult.status === "failed";
  const relevantTrials =
    trialFilterResult.status === "ok" ? trialFilterResult.items : [];
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
  const gapFlag =
    !trialFilterFailed && ratio > 10 && paperCount > 20 && relevantTrials.length > 0;

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

  const content = trialFilterFailed
    ? `Trial relevance filter unavailable — ${trials.length} trials retrieved across ${searchTerms.length} search terms, relevance not assessed.`
    : relevantTrials.length === 0
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
    content:
      content +
      (partial || trialFilterFailed
        ? " [Partial search — some sources unavailable]"
        : ""),
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
      partial: partial || trialFilterFailed,
      filter_failed: trialFilterFailed,
    },
  });

  const allCards = await getAllEvidenceCards(obj.id);
  const targetListCard = findTargetListCard(allCards);
  const rankedTargets = parseRankedTargetsFromCard(targetListCard);

  if (rankedTargets.length > 0) {
    const noveltyVerdicts = await firstInClassNoveltyCheck(obj, rankedTargets);
    await insertNoveltyCard(obj, noveltyVerdicts, partial);
  } else {
    const noveltyVerdicts = await firstInClassNoveltyCheckForHypothesis(obj);
    await insertNoveltyCard(obj, noveltyVerdicts, partial);
  }
}
