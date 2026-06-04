import type {
  AgentName,
  ChangeLogEntry,
  EvidenceCard,
  OpportunityObject,
} from "@/types/OpportunityObject";
import type { Paper } from "@/types/api";
import { buildPubMedEvidenceCard } from "@/agents/literatureAgent";
import { regulatoryAgentForCards } from "@/agents/regulatoryAgent";
import { callAgentJson } from "@/api/anthropic";
import { searchTrialsByTerm } from "@/api/clinicalTrials";
import { searchPatents } from "@/api/lens";
import { searchPubMed } from "@/api/pubmed";
import {
  getAllEvidenceCards,
  getOpportunityObject,
  insertEvidenceCard,
  updateOpportunityObject,
} from "@/lib/db";
import { refreshScores } from "@/lib/blackboard";
import {
  generateSurveillanceTags,
  surveillanceTagsNeedRegeneration,
} from "@/lib/surveillanceTags";
import type {
  SurveillanceScanSummary,
  SurveillanceStep,
} from "@/types/surveillanceProgress";
import { broadcastIntentSpaceEvent } from "@/lib/intentSpace/broadcaster";

export interface SurveillanceScanResult {
  lastCheckedAt: string;
  newCards: EvidenceCard[];
  newChallenges: EvidenceCard[];
  changeLogEntry: ChangeLogEntry | null;
  steps: SurveillanceStep[];
  summary: SurveillanceScanSummary | null;
  scores: {
    confidence_score: number;
    actionability_score: number;
    actionability_zone: OpportunityObject["actionability_zone"];
    status: OpportunityObject["status"];
  } | null;
}

export type SurveillanceProgressEvent =
  | { type: "step"; step: SurveillanceStep }
  | { type: "summary"; summary: SurveillanceScanSummary }
  | { type: "complete"; result: SurveillanceScanResult };

function extractPubMedId(sourceUrl: string): string | null {
  const match = sourceUrl.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i);
  return match?.[1] ?? null;
}

function extractNctId(sourceUrl: string, metadata: Record<string, unknown>): string | null {
  if (typeof metadata.nct_id === "string") return metadata.nct_id;
  const match = sourceUrl.match(/NCT\d+/i);
  return match?.[0]?.toUpperCase() ?? null;
}

const SURVEILLANCE_RELEVANCE_SYSTEM = `You are a relevance filter for a biomedical discovery system built by Arclight Bio.
Return valid JSON only — a JSON array of relevant papers.
When summarizing relevance, use intervention-class nouns (agonist, inhibitor) rather than bare target approval claims.`;

interface FilteredSurveillancePaper {
  pmid: string;
  title?: string;
}

export async function filterSurveillancePapers(
  hypothesis: OpportunityObject["hypothesis"],
  papers: Paper[]
): Promise<Paper[]> {
  if (papers.length === 0) return [];

  const newPapersJson = JSON.stringify(
    papers.map((paper) => ({
      pmid: paper.pmid,
      title: paper.title,
      abstract: paper.abstract.slice(0, 500),
      year: paper.year,
      journal: paper.journal,
    }))
  );

  const userPrompt = `You are a relevance filter for a biomedical discovery system.

The current hypothesis is: ${hypothesis.statement}

The following papers were retrieved because they matched a surveillance tag. For each paper, determine: is this paper genuinely relevant to the hypothesis above, or does it merely contain a matching keyword in an unrelated context?

Papers: ${newPapersJson}

Return only the papers that are directly relevant to the hypothesis. Return as JSON array of relevant papers only. If none are relevant, return empty array. Each object must include at least: pmid, title.`;

  try {
    const filtered = await callAgentJson<FilteredSurveillancePaper[]>(
      SURVEILLANCE_RELEVANCE_SYSTEM,
      userPrompt
    );
    if (!Array.isArray(filtered) || filtered.length === 0) return [];

    const relevantPmids = new Set(filtered.map((paper) => paper.pmid));
    return papers.filter((paper) => relevantPmids.has(paper.pmid));
  } catch {
    return [];
  }
}

function makeStep(
  id: string,
  icon: SurveillanceStep["icon"],
  description: string,
  opts?: { muted?: boolean; positive?: boolean }
): SurveillanceStep {
  return { id, icon, description, ...opts };
}

function buildChangeLogSummary(
  papersReviewed: number,
  tagsScanned: number,
  newPaperCount: number,
  confidenceDelta: number
): string {
  if (newPaperCount === 0) {
    return `Scan · field stable · ${papersReviewed} papers reviewed across ${tagsScanned} tags`;
  }

  const deltaLabel =
    confidenceDelta > 0
      ? `confidence +${Math.round(confidenceDelta * 100)}%`
      : confidenceDelta < 0
        ? `confidence ${Math.round(confidenceDelta * 100)}%`
        : "confidence unchanged";

  const paperLabel = newPaperCount === 1 ? "paper" : "papers";
  return `Scan · ${newPaperCount} new ${paperLabel} · ${deltaLabel} · Literature agent updated`;
}

function buildPanelSummary(
  newPaperCount: number,
  papersReviewed: number,
  newCardIds: string[]
): SurveillanceScanSummary {
  if (newPaperCount === 0) {
    return {
      message: "Scan complete · 0 new signals · field stable since last check",
      newSignals: 0,
      papersReviewed,
      tagsScanned: 0,
      confidenceDelta: 0,
      newCardIds: [],
      positive: false,
    };
  }

  return {
    message: `Scan complete · ${newPaperCount} new paper${newPaperCount === 1 ? "" : "s"} added · confidence updated`,
    newSignals: newPaperCount,
    papersReviewed,
    tagsScanned: 0,
    confidenceDelta: 0,
    newCardIds,
    positive: true,
  };
}

export async function runSurveillanceScan(
  opportunityId: string,
  onProgress?: (event: SurveillanceProgressEvent) => void
): Promise<SurveillanceScanResult> {
  const steps: SurveillanceStep[] = [];
  const emit = (event: SurveillanceProgressEvent) => {
    if (event.type === "step") steps.push(event.step);
    onProgress?.(event);
  };

  const obj = await getOpportunityObject(opportunityId);
  if (!obj) {
    throw new Error("Opportunity not found");
  }

  const now = new Date().toISOString();
  const emptyResult = (): SurveillanceScanResult => ({
    lastCheckedAt: now,
    newCards: [],
    newChallenges: [],
    changeLogEntry: null,
    steps,
    summary: null,
    scores: {
      confidence_score: obj.confidence_score,
      actionability_score: obj.actionability_score,
      actionability_zone: obj.actionability_zone,
      status: obj.status,
    },
  });

  if (obj.status === "paused") {
    return emptyResult();
  }

  if (obj.status !== "surveillance" && obj.status !== "complete") {
    return emptyResult();
  }

  if (obj.status === "complete") {
    await updateOpportunityObject(opportunityId, { status: "surveillance" });
    obj.status = "surveillance";
  }

  broadcastIntentSpaceEvent({
    type: "surveillance_started",
    opportunityId,
  });

  if (surveillanceTagsNeedRegeneration(obj.surveillance_tags)) {
    const regenerated = await generateSurveillanceTags(obj.hypothesis);
    await updateOpportunityObject(opportunityId, {
      surveillance_tags: {
        ...regenerated,
        last_checked_at: obj.surveillance_tags.last_checked_at,
      },
    });
    obj.surveillance_tags = regenerated;
  }

  const confidenceBefore = obj.confidence_score;
  const existingCards = await getAllEvidenceCards(opportunityId);
  const existingUrls = new Set(
    existingCards.map((c) => c.source_url).filter(Boolean)
  );
  const existingPmids = new Set(
    existingCards
      .map((c) => extractPubMedId(c.source_url))
      .filter((id): id is string => Boolean(id))
  );
  const existingNcts = new Set(
    existingCards
      .map((c) => extractNctId(c.source_url, c.raw_source_metadata))
      .filter((id): id is string => Boolean(id))
  );

  const conceptTags = obj.surveillance_tags.concept_tags.slice(0, 6);
  const entityTags = obj.surveillance_tags.entity_tags.slice(0, 4);
  let tagsScanned = 0;
  let papersReviewed = 0;
  const collectedRelevant: Paper[] = [];
  const seenPmids = new Set<string>();
  let stepCounter = 0;

  for (const tag of conceptTags) {
    tagsScanned += 1;
    const stepId = `pubmed-${stepCounter++}`;

    emit({
      type: "step",
      step: makeStep(stepId, "scanning", `Checking PubMed for "${tag}"…`),
    });

    const papers = await searchPubMed(tag, 15);
    const newPapers = papers.filter((paper) => {
      if (existingUrls.has(paper.source_url)) return false;
      if (existingPmids.has(paper.pmid)) return false;
      if (seenPmids.has(paper.pmid)) return false;
      return true;
    });

    emit({
      type: "step",
      step: makeStep(
        `${stepId}-found`,
        "scanning",
        `Checking PubMed for "${tag}" — ${papers.length} paper${papers.length === 1 ? "" : "s"} found`
      ),
    });

    if (newPapers.length === 0) {
      emit({
        type: "step",
        step: makeStep(
          `${stepId}-done`,
          "none",
          papers.length === 0
            ? `No papers found for "${tag}"`
            : `No new papers for "${tag}" since last scan`,
          { muted: true }
        ),
      });
      continue;
    }

    emit({
      type: "step",
      step: makeStep(
        `${stepId}-filter`,
        "scanning",
        `Running relevance filter on ${newPapers.length} paper${newPapers.length === 1 ? "" : "s"}…`
      ),
    });

    papersReviewed += newPapers.length;
    const relevant = await filterSurveillancePapers(obj.hypothesis, newPapers);

    if (relevant.length === 0) {
      emit({
        type: "step",
        step: makeStep(
          `${stepId}-filtered`,
          "filtered",
          `${newPapers.length} paper${newPapers.length === 1 ? "" : "s"} reviewed — 0 relevant to hypothesis`,
          { muted: true }
        ),
      });
      continue;
    }

    for (const paper of relevant) {
      if (!seenPmids.has(paper.pmid)) {
        seenPmids.add(paper.pmid);
        collectedRelevant.push(paper);
      }
    }

    emit({
      type: "step",
      step: makeStep(
        `${stepId}-relevant`,
        "relevant",
        `${relevant.length} paper${relevant.length === 1 ? "" : "s"} relevant — adding to evidence stream`,
        { positive: true }
      ),
    });
  }

  for (const tag of entityTags) {
    tagsScanned += 1;
    const trialStepId = `trial-${stepCounter++}`;

    emit({
      type: "step",
      step: makeStep(
        trialStepId,
        "scanning",
        `Checking ClinicalTrials.gov for "${tag}"…`
      ),
    });

    try {
      const trials = await searchTrialsByTerm(tag, 10);
      const newTrials = trials.filter((trial) => !existingNcts.has(trial.nctId));

      emit({
        type: "step",
        step: makeStep(
          `${trialStepId}-done`,
          "none",
          newTrials.length === 0
            ? "No new trials registered since last scan"
            : `${newTrials.length} new trial${newTrials.length === 1 ? "" : "s"} found (monitoring only)`,
          { muted: newTrials.length === 0 }
        ),
      });
    } catch {
      emit({
        type: "step",
        step: makeStep(
          `${trialStepId}-err`,
          "none",
          "ClinicalTrials.gov check unavailable",
          { muted: true }
        ),
      });
    }

    const patentStepId = `patent-${stepCounter++}`;
    emit({
      type: "step",
      step: makeStep(patentStepId, "scanning", `Checking patents for "${tag}"…`),
    });

    try {
      const patents = await searchPatents(tag, 5);
      const newPatents = patents.filter((p) => !existingUrls.has(p.source_url));

      emit({
        type: "step",
        step: makeStep(
          `${patentStepId}-done`,
          "none",
          newPatents.length === 0 ? "No new patents found" : `${newPatents.length} new patent${newPatents.length === 1 ? "" : "s"} found (monitoring only)`,
          { muted: newPatents.length === 0 }
        ),
      });
    } catch {
      emit({
        type: "step",
        step: makeStep(
          `${patentStepId}-err`,
          "none",
          "No new patents found",
          { muted: true }
        ),
      });
    }
  }

  await updateOpportunityObject(opportunityId, {
    surveillance_tags: {
      ...obj.surveillance_tags,
      last_checked_at: now,
    },
  });

  const insertedCards: EvidenceCard[] = [];
  for (const paper of collectedRelevant.slice(0, 3)) {
    const card = await insertEvidenceCard(
      opportunityId,
      buildPubMedEvidenceCard(paper, paper.title, { surveillance: true })
    );
    insertedCards.push(card);
  }

  if (insertedCards.length > 0) {
    await regulatoryAgentForCards(
      obj,
      insertedCards.map((card) => card.id)
    );
    await refreshScores(opportunityId);
  }

  const updated = await getOpportunityObject(opportunityId);
  const confidenceAfter = updated?.confidence_score ?? confidenceBefore;
  const confidenceDelta = confidenceAfter - confidenceBefore;

  const panelSummary = buildPanelSummary(
    insertedCards.length,
    papersReviewed,
    insertedCards.map((c) => c.id)
  );
  panelSummary.tagsScanned = tagsScanned;
  panelSummary.confidenceDelta = confidenceDelta;
  panelSummary.papersReviewed = papersReviewed;

  emit({ type: "summary", summary: panelSummary });

  let changeLogEntry: ChangeLogEntry | null = null;
  if (tagsScanned > 0) {
    changeLogEntry = {
      timestamp: now,
      trigger: insertedCards.length > 0 ? "new_pubmed_paper" : "surveillance_scan",
      agents_reinitiated:
        insertedCards.length > 0
          ? (["literature", "regulatory"] as AgentName[])
          : [],
      summary: buildChangeLogSummary(
        papersReviewed,
        tagsScanned,
        insertedCards.length,
        confidenceDelta
      ),
    };

    await updateOpportunityObject(opportunityId, {
      change_log: [...obj.change_log, changeLogEntry],
      status: "surveillance",
    });
  }

  const allCards = await getAllEvidenceCards(opportunityId);
  const newChallenges = allCards.filter(
    (c) =>
      c.is_challenge &&
      c.timestamp >= now &&
      insertedCards.some(
        (card) => c.challenge_metadata?.evidence_card_ref === card.id
      )
  );

  const finalObj = updated ?? obj;
  const result: SurveillanceScanResult = {
    lastCheckedAt: now,
    newCards: insertedCards,
    newChallenges,
    changeLogEntry,
    steps,
    summary: panelSummary,
    scores: {
      confidence_score: finalObj.confidence_score,
      actionability_score: finalObj.actionability_score,
      actionability_zone: finalObj.actionability_zone,
      status: finalObj.status,
    },
  };

  broadcastIntentSpaceEvent({
    type: "surveillance_completed",
    opportunityId,
    newSignals: insertedCards.length,
  });

  emit({ type: "complete", result });
  return result;
}
