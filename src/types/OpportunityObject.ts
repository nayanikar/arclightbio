export type AnchorType = "auto_generated" | "human_prompted";
export type ActionabilityZone = "too_early" | "act_now" | "crowded";
export type SourceType =
  | "pubmed"
  | "clinicaltrials"
  | "patent"
  | "rwe"
  | "fda"
  | "opentargets"
  | "semantic_scholar"
  | "internal_reasoning";
export type AgentName =
  | "literature"
  | "mechanism"
  | "clinical_trial"
  | "commercial"
  | "regulatory"
  | "rwe_signal"
  | "modality";

export type DomainContext =
  | "general"
  | "oncology first-in-class"
  | "autoimmune chronic"
  | "sex-specific biology"
  | "rare disease";

export type IndicationType = "oncology" | "autoimmune_chronic" | "rare_disease";

export interface DeriskRecommendation {
  study_type: string;
  primary_objective: string;
  patient_population: string;
  n_required: number;
  primary_endpoint: string;
  biomarkers_of_efficacy: string[];
  biomarkers_of_safety: string[];
  estimated_timeline: string;
  estimated_cost_range: string;
  closes_gap: string;
}

export type BlackboardAgentEventType =
  | "agent_started"
  | "agent_completed"
  | "agent_failed";

export interface BlackboardAgentEvent {
  type: BlackboardAgentEventType;
  agent: string;
  phase?: "early" | "full";
  error?: string;
  at: string;
}

export interface BlackboardState {
  completedSteps: string[];
  pauseReason?: "user_stopped" | "surveillance";
  lastError?: string;
  lastEvent?: BlackboardAgentEvent;
}

export type OpportunityStatus =
  | "initialising"
  | "agents_running"
  | "agents_failed"
  | "complete"
  | "surveillance"
  | "paused"
  | "archived";

export type EvidenceTier = "preclinical" | "clinical" | "established";

export interface QualityScores {
  sample_size: number;
  study_design: number;
  source_credibility: number;
  replication: number;
  recency: number;
  composite: number;
}

export interface EvidenceCard {
  id: string;
  content: string;
  source_url: string;
  source_type: SourceType;
  contributing_agent: AgentName;
  timestamp: string;
  quality_scores: QualityScores;
  regulatory_weight: number;
  raw_source_metadata: Record<string, unknown>;
  is_challenge?: boolean;
  challenge_metadata?: ChallengeMetadata;
  is_cross_domain?: boolean;
  is_target_list?: boolean;
  is_modality_card?: boolean;
  is_novelty_check?: boolean;
  derisk_recommendation?: DeriskRecommendation;
}

export interface ChallengeMetadata {
  evidence_card_ref: string;
  score_impact: number;
  dimension: keyof QualityScores;
}

export interface Challenge {
  id: string;
  content: string;
  flagged_by: "regulatory";
  evidence_card_ref: string;
  score_impact: number;
  dimension: keyof QualityScores;
}

export interface SurveillanceTags {
  concept_tags: string[];
  entity_tags: string[];
  signal_tags: string[];
  last_checked_at?: string;
}

export interface ChangeLogEntry {
  timestamp: string;
  trigger: string;
  agents_reinitiated: AgentName[];
  summary: string;
}

export interface ContextUpdateProposal {
  id: string;
  category: "competitor" | "market" | "asset" | "constraint";
  proposal: string;
  source_agent: AgentName;
  source_evidence: string;
  status: "pending" | "accepted" | "rejected";
}

export interface Hypothesis {
  statement: string;
  patient_population: string;
  unmet_need: string;
  org_positioning: string;
  source?: "llm" | "fallback";
}

export interface OpportunityObject {
  id: string;
  version: number;
  created_at: string;
  last_updated: string;
  anchor_type: AnchorType;
  status: OpportunityStatus;

  hypothesis: Hypothesis;

  confidence_score: number;
  actionability_score: number;
  actionability_zone: ActionabilityZone;

  evidence_cards: EvidenceCard[];
  challenges: Challenge[];
  surveillance_tags: SurveillanceTags;
  change_log: ChangeLogEntry[];
  context_update_proposals: ContextUpdateProposal[];

  org_context_id: string;
  search_query?: string;
  mode?: "speed" | "depth";
  evidence_tier?: EvidenceTier;
  query_tier?: EvidenceTier;
  prior_score?: number;
  domain_context?: DomainContext;
  indication_type?: IndicationType;
  blackboard_state?: BlackboardState;
}
