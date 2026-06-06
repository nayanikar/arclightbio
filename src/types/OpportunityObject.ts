import type { DecisionBrief } from "@/types/DecisionBrief";
import type {
  EvidenceSummary,
  TargetAlignment,
} from "@/types/MechanisticChain";
import type { ScoreDecomposition } from "@/lib/scoreDecomposition";
import type {
  DrugDiscoveryAssessmentRecord,
  IndRegulatoryPackageRecord,
  V3HypothesisFields,
  V3OpportunityFields,
} from "@/types/V3Pipeline";

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
  stage3_evaluation_summary?: string;
}

export type OpportunityStatus =
  | "initialising"
  | "agents_running"
  | "agents_failed"
  | "complete"
  | "surveillance"
  | "paused"
  | "archived";

/** Lightweight snapshot for status polling — no full evidence payloads. */
export interface OpportunityStatusSnapshot {
  id: string;
  status: OpportunityStatus;
  schema_version: 1 | 2 | 3;
  search_query?: string;
  confidence_score: number;
  actionability_zone: ActionabilityZone;
  last_updated: string;
  top_hypothesis_id: string | null;
  blackboard_state?: BlackboardState;
  hypothesis_count: number;
  evidence_card_count: number;
  pipeline_complete: boolean;
}

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
  hypothesis_id?: string;
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
  source?: "llm" | "fallback" | "outgroup";
}

export type DeclaredModality =
  | "small_molecule"
  | "mab"
  | "adc"
  | "rna"
  | "cell"
  | "gene";

export type RegulatoryPathway = "NDA" | "BLA";

export type OutgroupValidationStatus = "calibrated" | "scale_unreliable";

export interface OutgroupValidation {
  status: OutgroupValidationStatus;
  message: string;
  outgroup_confidence?: number;
  novel_median_confidence?: number;
  outgroup_challenge_count?: number;
  novel_median_challenges?: number;
}

export interface HypothesisRecord extends V3HypothesisFields {
  id: string;
  opportunity_object_id: string;
  rank: number | null;
  is_outgroup: boolean;
  statement: string;
  patient_population: string;
  unmet_need: string;
  org_positioning: string;
  source?: "llm" | "fallback" | "outgroup";
  cross_domain_score?: number | null;
  declared_modality?: DeclaredModality | null;
  regulatory_pathway?: RegulatoryPathway | null;
  confidence_score?: number | null;
  actionability_score?: number | null;
  actionability_zone?: ActionabilityZone | null;
  created_at?: string;
  evidence_cards?: EvidenceCard[];
  challenges?: Challenge[];
  target_alignment?: TargetAlignment | null;
  evidence_summary?: EvidenceSummary | null;
  score_decomposition?: ScoreDecomposition | null;
}

export interface OpportunityObject extends V3OpportunityFields {
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
  schema_version?: 1 | 2 | 3;
  top_hypothesis_id?: string | null;
  outgroup_validation?: OutgroupValidation | null;
  hypotheses?: HypothesisRecord[];
  selected_hypothesis_id?: string;
  decision_brief?: DecisionBrief | null;
  drug_discovery_assessment?: DrugDiscoveryAssessmentRecord | null;
  ind_package_v3?: IndRegulatoryPackageRecord | null;
  undruggable_targets?: Array<{ target_name: string; reasoning: string }> | null;
  /** Client cache field — precomputed discovery thesis for dashboard rehydration */
  discovery_thesis_title?: string | null;
}
