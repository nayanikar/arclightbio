export type DeclaredModality =
  | "small_molecule"
  | "mab"
  | "adc"
  | "rna"
  | "cell"
  | "gene";

export type RegulatoryPathway = "NDA" | "BLA";

export function modalityToRegulatoryPathway(
  modality: DeclaredModality
): RegulatoryPathway {
  return modality === "small_molecule" ? "NDA" : "BLA";
}

export function normalizeDeclaredModality(raw: string): DeclaredModality {
  const lower = raw.toLowerCase();
  if (lower.includes("small") || lower.includes("molecule")) return "small_molecule";
  if (lower.includes("adc") || lower.includes("conjugate")) return "adc";
  if (lower.includes("sirna") || lower.includes("aso") || lower.includes("mrna") || lower.includes("rna"))
    return "rna";
  if (lower.includes("cell")) return "cell";
  if (lower.includes("gene")) return "gene";
  if (lower.includes("antibody") || lower.includes("mab") || lower.includes("biologic"))
    return "mab";
  return "small_molecule";
}

export interface ModalityGateResult {
  declared_modality: DeclaredModality;
  regulatory_pathway: RegulatoryPathway;
  modality_rationale: string;
  manufacturing_complexity: number;
  estimated_timeline_to_IND: string;
  org_fit_score: number;
  key_infrastructure_requirement: string;
}

export interface ModalityAssessment {
  target: string;
  recommended_modality: string;
  modality_rationale: string;
  manufacturing_complexity: number;
  estimated_timeline_to_IND: string;
  org_fit_score: number;
  key_infrastructure_requirement: string;
  alternative_modality: string;
  alternative_rationale: string;
}
