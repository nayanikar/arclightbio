"use client";

import type {
  ChangeLogEntry,
  EvidenceCard,
  OpportunityObject,
  ActionabilityZone,
  OpportunityStatus,
  AgentName,
} from "@/types/OpportunityObject";
import type { SurveillanceScanResult } from "@/lib/surveillance";
import { notifyOpportunitiesUpdated } from "@/lib/events";
import { persistOpportunitySnapshot } from "@/lib/opportunityCache";
import { create } from "zustand";

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

  setOpportunity: (obj: OpportunityObject) => void;
  addCard: (card: EvidenceCard) => void;
  updateScores: (scores: {
    confidence_score: number;
    actionability_score: number;
    actionability_zone: ActionabilityZone;
    status?: OpportunityStatus;
  }) => void;
  applySurveillanceResult: (result: SurveillanceScanResult) => void;
  pauseSession: (entry: ChangeLogEntry) => void;
  resumeSession: (entry: ChangeLogEntry) => void;
  setStreaming: (streaming: boolean) => void;
  setSelectedAgent: (agent: AgentName | null) => void;
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

  setOpportunity: (obj) => {
    persistOpportunitySnapshot(obj);
    notifyOpportunitiesUpdated();
    set({
      opportunity: obj,
      confidenceScore: obj.confidence_score,
      actionabilityScore: obj.actionability_score,
      actionabilityZone: obj.actionability_zone,
      status: obj.status,
      changeLog: obj.change_log,
      lastSurveillanceCheck: obj.surveillance_tags.last_checked_at ?? null,
      streamingCards: obj.evidence_cards,
    });
  },

  addCard: (card) =>
    set((state) => ({
      streamingCards: state.streamingCards.some((c) => c.id === card.id)
        ? state.streamingCards
        : [...state.streamingCards, card],
    })),

  updateScores: (scores) => {
    set((state) => ({
      confidenceScore: scores.confidence_score,
      actionabilityScore: scores.actionability_score,
      actionabilityZone: scores.actionability_zone,
      status: scores.status ?? state.status,
      opportunity: state.opportunity
        ? {
            ...state.opportunity,
            confidence_score: scores.confidence_score,
            actionability_score: scores.actionability_score,
            actionability_zone: scores.actionability_zone,
            status: scores.status ?? state.opportunity.status,
            last_updated: new Date().toISOString(),
          }
        : null,
    }));
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

  resumeSession: (entry) => {
    set((state) => ({
      status: "surveillance",
      changeLog: [...state.changeLog, entry],
      opportunity: state.opportunity
        ? {
            ...state.opportunity,
            status: "surveillance",
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
    }),
}));
