export type MechanisticNodeType =
  | "gene"
  | "protein"
  | "cell"
  | "pathway"
  | "phenotype";

export type EvidenceClass = "association" | "causation" | "intervention";

export interface MechanisticChainNode {
  id: string;
  label: string;
  type: MechanisticNodeType;
}

export interface MechanisticChainEdge {
  from: string;
  to: string;
  evidence_class: EvidenceClass;
  confidence: number;
  evidence_card_ids: string[];
  rationale: string;
}

export interface MechanisticChain {
  nodes: MechanisticChainNode[];
  edges: MechanisticChainEdge[];
  overall_chain_confidence: number;
  gaps: string[];
  generated_at: string;
}

export interface TargetAlignment {
  status: "aligned" | "mismatch" | "no_targets";
  declared_entities: string[];
  top_ranked_target?: string;
  top_ranked_gene?: string;
  message: string;
}

export interface EvidenceSummary {
  association: number;
  causation: number;
  intervention: number;
}
