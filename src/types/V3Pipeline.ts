import type { MechanisticChain } from "@/types/MechanisticChain";

export type InnovationLevel = "lowest" | "medium" | "highest";

export type ParentDomain =
  | "oncology"
  | "immunology"
  | "autoimmune"
  | "neurology"
  | "cardiology"
  | "metabolism"
  | "rare_disease"
  | "infectious_disease"
  | "dermatology"
  | "respiratory"
  | "nephrology"
  | "hepatology"
  | "hematology"
  | "endocrinology"
  | "reproductive_health";

export type V3Phase =
  | "phase1:population"
  | "phase1:anchors"
  | "phase1:market_size"
  | "phase1:cd1"
  | "phase1:cd2"
  | "phase1:expert_domains"
  | "phase1:biology_recurrence"
  | "phase1:association_filter"
  | "phase1:literature_review"
  | "phase1:context_mine"
  | "phase1:association_generate"
  | "phase1:causation_filter"
  | "phase1:selectivity_filter"
  | "phase1:selectivity_rank"
  | "phase1:selectivity_targets"
  | "phase1:falsification_exp"
  | "phase1:complete"
  | "phase2:target_screen"
  | "phase2:drug_check"
  | "phase2:ip_fto"
  | "phase2:druggability"
  | "phase2:modality"
  | "phase2:tpp"
  | "phase2:risk_scores"
  | "phase2:ind_package"
  | "phase2:complete";

export type HypothesisStage = "association" | "causation" | "selectivity";
export type V3AnchorType = "biology" | "resistance";
export type AssociationType = "disease" | "organ" | "molecular";
export type DirectionStatus = "supported" | "disputed" | "unsupported";
export type ExpertDomainSource = "cd1" | "cd2" | "merged";
export type DrugDiscoveryBranch = "existing" | "new";
export type ModalityPathway = "NDA" | "BLA";

export interface AnchorProfile {
  population: string;
  market_size?: string;
  market_size_usd_b?: number;
  market_size_rationale?: string;
  rationale: string;
  anchor_statement: string;
}

export interface AnchorProfiles {
  biology: AnchorProfile;
  resistance: AnchorProfile;
}

export interface ExpertDomain {
  domain: string;
  source: ExpertDomainSource;
  recurrence_rate?: number;
  recurrence_score?: number;
  association_types?: AssociationType[];
  rationale?: string;
  description?: string;
  biology_recurrence_rate?: number;
  different_context?: string;
  filtered?: boolean;
  filter_rationale?: string;
}

export interface CD1Pattern {
  domain: string;
  pattern: string;
  recurrence_rate: number;
  patient_count: number;
  co_occurring_features: string[];
  parent_domain: string;
}

export interface CD2Association {
  domain: string;
  association_type: AssociationType;
  association_claim: string;
  evidence_sources: string[];
  confidence: number;
  pubmed_query?: string;
}

export interface PopulationDefinition {
  definition: string;
  inclusion_criteria: string[];
  exclusion_criteria: string[];
  unmet_need: string;
  cohort_summary: string;
  estimated_prevalence?: string;
}

export interface CrossContextSeed {
  claim: string;
  parent_domain_context: string;
  expert_domain: string;
  mechanism_bridge: string;
  confidence: number;
}

export interface DroppedLink {
  original_claim: string;
  dropped_at_stage: HypothesisStage;
  reason: string;
}

export interface DirectionHypothesis {
  direction: "agonist" | "antagonist" | "inhibit" | "activate" | "other";
  claim: string;
  evidence_summary?: string;
}

export interface RankDecomposition {
  anchor_fidelity: number;
  evidence_strength: number;
  selectivity_feasibility: number;
  overall: number;
}

export interface ProgramTrustBreakdown {
  overall: number;
  funnel_coverage: number;
  evidence_strength: number;
  biology_signal: number;
  label: "exploratory" | "moderate" | "strong";
  /** LLM-generated explanation tied to program artifacts */
  rationale?: string;
  /** Whether score came from LLM judgment or deterministic formula */
  assessment_source?: "llm" | "formula";
}

export interface RankedTarget {
  rank: number;
  target_name: string;
  target?: string;
  gene_symbol?: string;
  association_strength?: number;
  causation_strength?: number;
  association_score?: number;
  causation_score?: number;
  selectivity_feasibility: number;
  rationale: string;
}

export interface FalsificationExperiment {
  objective: string;
  design: string;
  primary_readout?: string;
  primary_endpoint?: string;
  success_criteria?: string;
  failure_criteria?: string;
  disproves_if?: string;
  estimated_timeline?: string;
  timeline_estimate?: string;
  estimated_cost_range?: string;
  cost_estimate?: string;
  direction_discrimination?: boolean | string;
  reconnection_test?: boolean;
  reconnection_experiments?: string[];
}

export interface TargetFamilyContext {
  target_name?: string;
  primary_target?: string;
  family_taxonomy?: string;
  family_name?: string;
  structural_class?: string;
  subcellular_location?: string;
  pathway_networks?: string[];
  activation_mechanism?: string;
  references?: string[];
  key_references?: string[];
}

export interface V3HypothesisFields {
  hypothesis_stage?: HypothesisStage | null;
  parent_hypothesis_id?: string | null;
  falsifiability_statement?: string | null;
  anchor_type?: V3AnchorType | null;
  anchor_linkage?: string | null;
  dropped_links?: DroppedLink[];
  new_moa_requires_experiment?: boolean;
  mechanistic_chain?: MechanisticChain | null;
  intervention_direction_hypothesis?: string | null;
  direction_status?: DirectionStatus | null;
  direction_hypotheses?: DirectionHypothesis[];
  rank_decomposition?: RankDecomposition | null;
  ranking_rationale?: string | null;
  ranked_targets?: RankedTarget[] | null;
  falsification_experiment?: FalsificationExperiment | null;
  target_family_context?: TargetFamilyContext | null;
}

export interface V3OpportunityFields {
  innovation_level?: InnovationLevel | null;
  parent_domain?: ParentDomain | null;
  cohort_id?: string | null;
  program_hypothesis_sentence?: string | null;
  population_definition?: PopulationDefinition | null;
  anchor_profiles?: AnchorProfiles | null;
  expert_domains?: ExpertDomain[] | null;
  cd1_patterns?: CD1Pattern[] | null;
  cd2_associations?: CD2Association[] | null;
  cross_context_seeds?: CrossContextSeed[] | null;
  selected_phase2_hypothesis_id?: string | null;
  v3_phase?: V3Phase | string | null;
  program_trust_score?: number | null;
  program_trust_breakdown?: ProgramTrustBreakdown | null;
}

export interface CohortDomainSummary {
  primary_diagnosis_counts: Record<string, number>;
  comorbidity_counts: Record<string, number>;
  biomarker_counts: Record<string, number>;
  resistance_status_counts: Record<string, number>;
  non_parent_domain_patterns: Array<{
    domain: string;
    recurrence_rate: number;
    patient_count: number;
  }>;
}

export interface PatientCohort {
  id: string;
  name?: string | null;
  file_name: string;
  row_count: number;
  domain_summary: CohortDomainSummary;
  uploaded_at: string;
}

export interface CohortPatientRow {
  id: string;
  cohort_id: string;
  patient_id: string;
  primary_diagnosis: string;
  comorbidities: string[];
  biomarkers?: string | null;
  resistance_status?: string | null;
  notes?: string | null;
  created_at?: string;
}

export interface CohortParseResult {
  cohort: Omit<PatientCohort, "id" | "uploaded_at">;
  patients: Array<
    Omit<CohortPatientRow, "id" | "cohort_id" | "created_at">
  >;
  warnings: string[];
}

export interface BiomarkerCategories {
  predictive: string[];
  target_engagement_pd: string[];
  safety: string[];
  surrogate: string[];
}

export interface TppBlueprint {
  product_characteristics: string;
  tissue_delivery: string;
  evidence_collection_plan: string;
  falsifiable_product_claim: string;
  anchor_link_preserved: boolean;
  lost_link_flag: boolean;
  intervention_direction_hypothesis?: string;
  direction_status?: DirectionStatus;
  indication_scope: string;
  competitive_positioning_vs_soc: string;
  clinician_patient_choice_rationale: string;
  first_in_class_mechanism_claim: string;
  biomarkers: BiomarkerCategories;
  product_assumptions: string[];
}

export type DrugPipelineStatus = "active" | "blocked_undruggable";

export interface DrugDiscoveryAssessment {
  drug_exists: boolean;
  branch: DrugDiscoveryBranch;
  pipeline_status?: DrugPipelineStatus;
  blocked_reason?: string;
  screened_primary_target?: string;
  existing_drug_name?: string;
  existing_drug_mechanism?: string;
  in_clinic_for_indication?: boolean;
  ip_summary?: string;
  fto_summary?: string;
  redesign_feasibility?: string;
  adc_path_viable?: boolean;
  druggability_score?: number;
  druggability_rationale?: string;
  selected_modality?: string;
  modality_rationale?: string;
}

export interface DrugDiscoveryAssessmentRecord {
  id: string;
  opportunity_object_id: string;
  hypothesis_id: string;
  drug_exists: boolean | null;
  branch: DrugDiscoveryBranch | null;
  assessment: DrugDiscoveryAssessment;
  tpp_blueprint: TppBlueprint | null;
  created_at: string;
  updated_at: string;
}

export interface RiskComponents {
  target: number;
  ip: number;
  modality_development: number;
  market_penetration: number;
  infrastructure: number;
  competition: number;
  other: number;
}

export interface ClinicalDevelopmentPlan {
  trial_type: string;
  design: string;
  sample_size: number;
  inclusion_criteria: string[];
  exclusion_criteria: string[];
  biomarkers: BiomarkerCategories;
  primary_endpoint: string;
  secondary_endpoints: string[];
}

export interface IndRegulatoryPackageV3 {
  preclinical_roadmap: string[];
  cmc_requirements: string[];
  tox_studies: string[];
  clinical_development_plan: ClinicalDevelopmentPlan;
  target_agency: "FDA" | "EMA" | "both";
  assembly_notes?: string;
}

export interface IndRegulatoryPackageRecord {
  id: string;
  opportunity_object_id: string;
  hypothesis_id: string;
  package: IndRegulatoryPackageV3;
  risk_of_failure: number | null;
  risk_components: RiskComponents;
  modality_pathway: ModalityPathway | null;
  created_at: string;
  updated_at: string;
}

export interface UndruggableTargetRecord {
  id: string;
  opportunity_object_id?: string | null;
  hypothesis_id?: string | null;
  target_name: string;
  intervention_point?: string | null;
  reasoning: string;
  alternate_intervention?: string | null;
  rescan_eligible?: boolean;
  created_at: string;
}

export interface CalibrationRegistryEntry {
  id: string;
  source_opportunity_id?: string | null;
  source_hypothesis_id?: string | null;
  domain_a: string;
  domain_b: string;
  association_claim: string;
  rejection_reason?: string | null;
  notes?: string | null;
  promoted_at: string;
}

export interface CreateOpportunityObjectV3Input {
  anchor_type: "auto_generated" | "human_prompted";
  org_context_id: string;
  search_query: string;
  parent_domain: ParentDomain;
  cohort_id: string;
  innovation_level?: InnovationLevel;
  mode?: "speed" | "depth";
}

export interface UpdateV3OpportunityFieldsInput {
  innovation_level?: InnovationLevel;
  parent_domain?: ParentDomain;
  cohort_id?: string;
  program_hypothesis_sentence?: string;
  anchor_profiles?: AnchorProfiles;
  expert_domains?: ExpertDomain[];
  selected_phase2_hypothesis_id?: string | null;
  v3_phase?: V3Phase | string;
  population_definition?: PopulationDefinition | null;
  cd1_patterns?: CD1Pattern[] | null;
  cd2_associations?: CD2Association[] | null;
  cross_context_seeds?: CrossContextSeed[] | null;
  program_trust_score?: number | null;
  program_trust_breakdown?: ProgramTrustBreakdown | null;
}

/** Row-level patient shape used by Phase 1 agents and cohort CSV. */
export interface CohortPatient {
  patient_id: string;
  primary_diagnosis: string;
  comorbidities: string[];
  biomarkers: string[];
  resistance_status: string;
  notes: string;
}

/** Agent-facing cohort bundle (may include inline patients). */
export interface CohortRecord {
  id: string;
  opportunity_object_id?: string;
  filename?: string;
  patient_count: number;
  domain_summary: string;
  patients: CohortPatient[];
  created_at: string;
}

export interface V3HypothesisRecord extends V3HypothesisFields {
  id: string;
  opportunity_object_id: string;
  statement: string;
  patient_population: string;
  unmet_need: string;
  org_positioning: string;
  rank?: number | null;
  created_at?: string;
}
