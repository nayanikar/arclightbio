export type OrgType =
  | "large_pharma"
  | "biotech_startup"
  | "diagnostics"
  | "academic_medical_center"
  | "vc_fund"
  | "bd_team";

export type DiscoveryHorizon =
  | "asset_extension"
  | "portfolio_combination"
  | "capability_driven_new_product";

export interface OrganizationContext {
  id: string;
  org_name: string;
  org_type: OrgType;

  portfolio: {
    approved_assets: string[];
    pipeline_assets: string[];
    platforms: string[];
    therapeutic_areas: string[];
  };

  commercial_weights: {
    market_size_importance: number;
    first_mover_importance: number;
    competitive_moat_importance: number;
    reimbursement_pathway_importance: number;
  };

  risk_tolerance: {
    actionability_lower_threshold: number;
    actionability_upper_threshold: number;
  };

  discovery_horizons: DiscoveryHorizon[];

  surveillance_defaults: {
    scan_frequency_act_now: "daily" | "weekly";
    scan_frequency_too_early: "weekly" | "monthly";
  };
}
