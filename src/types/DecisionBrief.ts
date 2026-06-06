import type { DeriskRecommendation } from "@/types/OpportunityObject";
import type { DirectionAudit } from "@/lib/interventionDirection";
import type { ScoreDecomposition } from "@/lib/scoreDecomposition";

export type DecisionRecommendation = "pursue" | "watch" | "kill" | "partner";

export interface DecisionBriefTpp {
  minimum: string;
  base: string;
  aspirational: string;
}

export interface DecisionBriefRisk {
  risk: string;
  severity: "high" | "medium";
  evidence_card_ids: string[];
}

export interface DecisionBriefNextProof {
  study_type: string;
  primary_endpoint: string;
  n_required: number;
  estimated_timeline: string;
  estimated_cost_range: string;
  closes_gap: string;
}

export interface DecisionBriefPortfolioFit {
  therapeutic_area_overlap: boolean;
  modality_in_platform: boolean;
  summary: string;
}

export interface DecisionBriefBiomarkers {
  efficacy: string[];
  safety: string[];
  engagement: string[];
}

export interface DecisionBriefDiseaseModel {
  model: string;
  rationale: string;
  evidence_card_ids: string[];
}

export interface CompetitiveLandscape {
  approved: string[];
  active: string[];
  failed: string[];
  patent_density: string;
  differentiation_summary: string;
}

export interface DecisionBrief {
  recommendation: DecisionRecommendation;
  recommendation_rationale: string;
  calibration_caveat?: string;
  top_hypothesis_id: string;
  top_hypothesis_statement?: string;
  tpp: DecisionBriefTpp;
  differentiation: string;
  critical_risks: DecisionBriefRisk[];
  derisk_plan: DeriskRecommendation[];
  next_proof_point: DecisionBriefNextProof;
  portfolio_fit: DecisionBriefPortfolioFit;
  hypothesis_ranking_summary: string;
  evidence_card_ids: string[];
  generated_at: string;
  score_interpretation?: string;
  score_decomposition?: ScoreDecomposition;
  interventional_direction?: DirectionAudit;
  recommended_biomarkers?: DecisionBriefBiomarkers;
  recommended_models?: DecisionBriefDiseaseModel[];
  competitive_landscape?: CompetitiveLandscape;
}
