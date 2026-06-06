"use client";

import type { AgentTrailEntry } from "@/types/AgentTrail";
import { deriveCurrentTrailActivity } from "@/lib/trailLabels";
import type {
  ChangeLogEntry,
  Challenge,
  EvidenceCard,
  OpportunityObject,
  ActionabilityZone,
  OpportunityStatus,
  AgentName,
  BlackboardAgentEvent,
} from "@/types/OpportunityObject";
import type { SurveillanceScanResult } from "@/lib/surveillance";
import { notifyOpportunitiesUpdated } from "@/lib/events";
import { persistOpportunitySnapshot } from "@/lib/opportunityCache";
import { create } from "zustand";

function challengeToCard(
  challenge: Challenge,
  hypothesisId?: string
): EvidenceCard {
  return {
    id: challenge.id,
    content: challenge.content,
    source_url: "",
    source_type: "fda",
    contributing_agent: "regulatory",
    timestamp: new Date().toISOString(),
    hypothesis_id: hypothesisId,
    quality_scores: {
      sample_size: 0.5,
      study_design: 0.5,
      source_credibility: 0.5,
      replication: 0.5,
      recency: 0.5,
      composite: 0.5,
    },
    regulatory_weight: 0.5,
    raw_source_metadata: {},
    is_challenge: true,
    challenge_metadata: {
      evidence_card_ref: challenge.evidence_card_ref,
      score_impact: challenge.score_impact,
      dimension: challenge.dimension,
    },
  };
}

export function buildStreamingCardsFromOpportunity(
  obj: OpportunityObject
): EvidenceCard[] {
  if ((obj.schema_version ?? 1) !== 2 && (obj.schema_version ?? 1) !== 3) {
    return [
      ...obj.evidence_cards,
      ...obj.challenges.map((ch) => challengeToCard(ch)),
    ];
  }

  const cards: EvidenceCard[] = [...obj.evidence_cards];
  for (const h of obj.hypotheses ?? []) {
    for (const c of h.evidence_cards ?? []) {
      cards.push({ ...c, hypothesis_id: h.id });
    }
    for (const ch of h.challenges ?? []) {
      cards.push(challengeToCard(ch, h.id));
    }
  }
  return cards;
}

interface OpportunityState {
  opportunity: OpportunityObject | null;
  streamingCards: EvidenceCard[];
  changeLog: ChangeLogEntry[];
  lastSurveillanceCheck: string | null;
  confidenceScore: number;
  actionabilityScore: number;
  actionabilityZone: ActionabilityZone;
  status: OpportunityStatus;
  isStreaming: boolean;
  selectedAgent: AgentName | null;
  blackboardError: string | null;
  lastAgentStatus: BlackboardAgentEvent | null;
  trailEntries: AgentTrailEntry[];
  currentTrailActivity: AgentTrailEntry | null;

  setOpportunity: (obj: OpportunityObject) => void;
  addCard: (card: EvidenceCard) => void;
  updateScores: (scores: {
    confidence_score: number;
    actionability_score: number;
    actionability_zone: ActionabilityZone;
    status?: OpportunityStatus;
    blackboard_error?: string | null;
    schema_version?: 2 | 3;
    top_hypothesis_id?: string | null;
    hypotheses?: Array<{
      id: string;
      rank: number | null;
      confidence_score: number;
      actionability_score: number;
      actionability_zone: ActionabilityZone;
    }>;
    outgroup_validation?: OpportunityObject["outgroup_validation"];
    v3_phase?: string | null;
  }) => void;
  applySurveillanceResult: (result: SurveillanceScanResult) => void;
  pauseSession: (entry: ChangeLogEntry) => void;
  resumeSession: (entry: ChangeLogEntry, status?: OpportunityStatus) => void;
  setStreaming: (streaming: boolean) => void;
  setSelectedAgent: (agent: AgentName | null) => void;
  setBlackboardError: (message: string | null) => void;
  setAgentStatus: (event: BlackboardAgentEvent | null) => void;
  setTrailEntries: (entries: AgentTrailEntry[]) => void;
  addTrailEntry: (entry: AgentTrailEntry) => void;
  reset: () => void;
}

export const useOpportunityStore = create<OpportunityState>((set) => ({
  opportunity: null,
  streamingCards: [],
  changeLog: [],
  lastSurveillanceCheck: null,
  confidenceScore: 0,
  actionabilityScore: 0,
  actionabilityZone: "too_early",
  status: "initialising",
  isStreaming: false,
  selectedAgent: null,
  blackboardError: null,
  lastAgentStatus: null,
  trailEntries: [],
  currentTrailActivity: null,

  setOpportunity: (obj) => {
    persistOpportunitySnapshot(obj);
    notifyOpportunitiesUpdated();
    const streamingCards = buildStreamingCardsFromOpportunity(obj);
    set({
      opportunity: obj,
      confidenceScore: obj.confidence_score,
      actionabilityScore: obj.actionability_score,
      actionabilityZone: obj.actionability_zone,
      status: obj.status,
      changeLog: obj.change_log,
      lastSurveillanceCheck: obj.surveillance_tags.last_checked_at ?? null,
      streamingCards,
      blackboardError: obj.blackboard_state?.lastError ?? null,
    });
  },

  addCard: (card) =>
    set((state) => ({
      streamingCards: state.streamingCards.some((c) => c.id === card.id)
        ? state.streamingCards
        : [...state.streamingCards, card],
    })),

  updateScores: (scores) => {
    set((state) => {
      let opportunity = state.opportunity;
      if (opportunity && scores.hypotheses?.length) {
        const patchById = new Map(scores.hypotheses.map((h) => [h.id, h]));
        opportunity = {
          ...opportunity,
          confidence_score: scores.confidence_score,
          actionability_score: scores.actionability_score,
          actionability_zone: scores.actionability_zone,
          status: scores.status ?? opportunity.status,
          last_updated: new Date().toISOString(),
          top_hypothesis_id:
            scores.top_hypothesis_id ?? opportunity.top_hypothesis_id,
          outgroup_validation:
            scores.outgroup_validation ?? opportunity.outgroup_validation,
          hypotheses: (opportunity.hypotheses ?? []).map((h) => {
            const patch = patchById.get(h.id);
            return patch ? { ...h, ...patch } : h;
          }),
        };
      } else if (opportunity) {
        opportunity = {
          ...opportunity,
          confidence_score: scores.confidence_score,
          actionability_score: scores.actionability_score,
          actionability_zone: scores.actionability_zone,
          status: scores.status ?? opportunity.status,
          v3_phase:
            scores.v3_phase !== undefined
              ? scores.v3_phase ?? undefined
              : opportunity.v3_phase,
          last_updated: new Date().toISOString(),
        };
      }

      return {
        confidenceScore: scores.confidence_score,
        actionabilityScore: scores.actionability_score,
        actionabilityZone: scores.actionability_zone,
        status: scores.status ?? state.status,
        blackboardError:
          scores.blackboard_error !== undefined
            ? scores.blackboard_error
            : state.blackboardError,
        opportunity,
      };
    });
    const opp = useOpportunityStore.getState().opportunity;
    if (opp) persistOpportunitySnapshot(opp);
    notifyOpportunitiesUpdated();
  },

  applySurveillanceResult: (result) => {
    set((state) => {
      const nextCards = [...state.streamingCards];
      for (const card of [...result.newCards, ...result.newChallenges]) {
        if (!nextCards.some((existing) => existing.id === card.id)) {
          nextCards.push(card);
        }
      }

      const nextChangeLog = result.changeLogEntry
        ? [...state.changeLog, result.changeLogEntry]
        : state.changeLog;

      const hasNewCards =
        result.newCards.length > 0 || result.newChallenges.length > 0;
      const scoresChanged =
        result.scores != null &&
        (result.scores.confidence_score !== state.confidenceScore ||
          result.scores.actionability_score !== state.actionabilityScore ||
          result.scores.actionability_zone !== state.actionabilityZone ||
          result.scores.status !== state.status);

      return {
        streamingCards: nextCards,
        changeLog: nextChangeLog,
        lastSurveillanceCheck: result.lastCheckedAt,
        confidenceScore:
          hasNewCards || scoresChanged
            ? (result.scores?.confidence_score ?? state.confidenceScore)
            : state.confidenceScore,
        actionabilityScore:
          hasNewCards || scoresChanged
            ? (result.scores?.actionability_score ?? state.actionabilityScore)
            : state.actionabilityScore,
        actionabilityZone:
          hasNewCards || scoresChanged
            ? (result.scores?.actionability_zone ?? state.actionabilityZone)
            : state.actionabilityZone,
        status:
          hasNewCards || scoresChanged
            ? (result.scores?.status ?? state.status)
            : state.status,
        opportunity: state.opportunity
          ? {
              ...state.opportunity,
              change_log: nextChangeLog,
              surveillance_tags: {
                ...state.opportunity.surveillance_tags,
                last_checked_at: result.lastCheckedAt,
              },
              confidence_score:
                hasNewCards || scoresChanged
                  ? (result.scores?.confidence_score ??
                    state.opportunity.confidence_score)
                  : state.opportunity.confidence_score,
              actionability_score:
                hasNewCards || scoresChanged
                  ? (result.scores?.actionability_score ??
                    state.opportunity.actionability_score)
                  : state.opportunity.actionability_score,
              actionability_zone:
                hasNewCards || scoresChanged
                  ? (result.scores?.actionability_zone ??
                    state.opportunity.actionability_zone)
                  : state.opportunity.actionability_zone,
              status:
                hasNewCards || scoresChanged
                  ? (result.scores?.status ?? state.opportunity.status)
                  : state.opportunity.status,
            }
          : null,
      };
    });
    const opp = useOpportunityStore.getState().opportunity;
    if (opp) persistOpportunitySnapshot(opp);
    notifyOpportunitiesUpdated();
  },

  pauseSession: (entry) => {
    set((state) => ({
      status: "paused",
      changeLog: [...state.changeLog, entry],
      opportunity: state.opportunity
        ? {
            ...state.opportunity,
            status: "paused",
            change_log: [...state.opportunity.change_log, entry],
          }
        : null,
    }));
    const opp = useOpportunityStore.getState().opportunity;
    if (opp) persistOpportunitySnapshot(opp);
    notifyOpportunitiesUpdated();
  },

  resumeSession: (entry, status = "surveillance") => {
    set((state) => ({
      status,
      changeLog: [...state.changeLog, entry],
      opportunity: state.opportunity
        ? {
            ...state.opportunity,
            status,
            change_log: [...state.opportunity.change_log, entry],
          }
        : null,
    }));
    const opp = useOpportunityStore.getState().opportunity;
    if (opp) persistOpportunitySnapshot(opp);
    notifyOpportunitiesUpdated();
  },

  setStreaming: (streaming) => set({ isStreaming: streaming }),
  setSelectedAgent: (agent) => set({ selectedAgent: agent }),
  setBlackboardError: (message) => set({ blackboardError: message }),
  setAgentStatus: (event) => set({ lastAgentStatus: event }),
  setTrailEntries: (entries) =>
    set({
      trailEntries: entries,
      currentTrailActivity: deriveCurrentTrailActivity(entries),
    }),
  addTrailEntry: (entry) =>
    set((state) => {
      if (state.trailEntries.some((e) => e.id === entry.id)) {
        return state;
      }
      const trailEntries = [...state.trailEntries, entry];
      return {
        trailEntries,
        currentTrailActivity: deriveCurrentTrailActivity(trailEntries),
      };
    }),
  reset: () =>
    set({
      opportunity: null,
      streamingCards: [],
      changeLog: [],
      lastSurveillanceCheck: null,
      confidenceScore: 0,
      actionabilityScore: 0,
      actionabilityZone: "too_early",
      status: "initialising",
      isStreaming: false,
      selectedAgent: null,
      blackboardError: null,
      lastAgentStatus: null,
      trailEntries: [],
      currentTrailActivity: null,
    }),
}));
