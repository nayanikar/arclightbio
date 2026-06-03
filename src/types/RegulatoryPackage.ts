import type { AgentName } from "./OpportunityObject";

export type CredibilityRating = "high" | "moderate" | "low";
export type TargetAgency = "FDA" | "EMA" | "both";

export interface RegulatoryPackage {
  id: string;
  opportunity_object_id: string;
  opportunity_object_version: number;
  assembly_timestamp: string;
  target_agency: TargetAgency;

  credibility_report: {
    ai_role_declaration: string;
    evidence_sections: Array<{
      section: string;
      ai_generated_items: number;
      human_validated_items: number;
      average_regulatory_weight: number;
      credibility_rating: CredibilityRating;
    }>;
  };

  gap_report: Array<{
    gap_description: string;
    required_action: string;
    blocking: boolean;
  }>;

  provenance_trail: Array<{
    claim: string;
    source_chain: string[];
    retrieval_method: string;
    agent: AgentName;
    timestamp: string;
    raw_api_response_hash: string;
  }>;

  version_lock_hash: string;
}
