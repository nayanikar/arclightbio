export type TrailEntryKind = "started" | "completed" | "failed" | "source" | "reasoning";

export type TrailSourceType =
  | "pubmed"
  | "clinicaltrials"
  | "patent"
  | "cohort"
  | "fda"
  | "internal"
  | "other";

export interface TrailSource {
  label: string;
  url: string;
  type: TrailSourceType;
  excerpt?: string;
}

export interface AgentTrailEntry {
  id: string;
  opportunity_id: string;
  timestamp: string;
  step: string;
  agent: string;
  phase: "phase1" | "phase2" | "surveillance";
  kind: TrailEntryKind;
  title: string;
  summary?: string;
  sources?: TrailSource[];
  evidence_card_ids?: string[];
  hypothesis_id?: string;
  metadata?: Record<string, unknown>;
}

export type AppendTrailEntryInput = Omit<
  AgentTrailEntry,
  "id" | "opportunity_id" | "timestamp"
> & {
  id?: string;
  timestamp?: string;
};
