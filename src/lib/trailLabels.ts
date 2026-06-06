import type { AgentTrailEntry, TrailSourceType } from "@/types/AgentTrail";

const STEP_LABELS: Record<string, string> = {
  "phase1:population": "Patient population definition",
  "phase1:anchors": "Anchor population profiling",
  "phase1:market_size": "Market size estimation",
  "phase1:cd1": "CD1 pattern mining",
  "phase1:cd2": "CD2 association scan",
  "phase1:expert_domains": "Expert domain merger",
  "phase1:biology_recurrence": "Biology recurrence scoring",
  "phase1:association_filter": "Cross-domain association filter",
  "phase1:literature_review": "Cross-domain literature review",
  "phase1:context_mine": "Cross-context hypothesis mining",
  "phase1:association_generate": "Association hypothesis generation",
  "phase1:causation_filter": "Causation filter",
  "phase1:selectivity_filter": "Selectivity filter",
  "phase1:selectivity_rank": "Selectivity ranking",
  "phase1:selectivity_targets": "Selectivity target ranking",
  "phase1:complete": "Phase 1 complete",
  "phase2:target_screen": "Target druggability screen",
  "phase2:drug_check": "Existing drug check",
  "phase2:ip_fto": "IP & FTO analysis",
  "phase2:druggability": "Druggability assessment",
  "phase2:modality": "Modality selection",
  "phase2:tpp": "TPP blueprint",
  "phase2:risk_scores": "Risk scoring & IND planning",
  "phase2:ind_package": "IND package assembly",
  "phase2:complete": "Phase 2 complete",
};

const AGENT_LABELS: Record<string, string> = {
  patientPopulationAgent: "Patient population",
  anchorPopulationAgent: "Anchor profiling",
  marketSizeAgent: "Market sizing",
  cd1PatternAgent: "CD1 patterns",
  cd2AssociationAgent: "CD2 associations",
  expertDomainMergerAgent: "Expert domains",
  biologyRecurrenceScorerAgent: "Biology recurrence",
  crossDomainAssociationFilterAgent: "Association filter",
  crossDomainLiteratureAgent: "Literature review",
  crossContextHypothesisMinerAgent: "Context mining",
  associationHypothesisGeneratorAgent: "Hypothesis generation",
  causationFilterAgent: "Causation filter",
  selectivityFilterAgent: "Selectivity filter",
  selectivityRankerAgent: "Selectivity ranker",
  selectivityTargetRankerAgent: "Target ranker",
  targetFamilyContextAgent: "Target family context",
  falsificationExperimentDesignerAgent: "Falsification design",
  existingDrugCheckerAgent: "Drug checker",
  ipOwnershipAgent: "IP ownership",
  ftoAnalysisAgent: "FTO analysis",
  targetDruggabilityScreenAgent: "Target screen",
  druggabilityAssessmentAgent: "Druggability",
  modalitySelectorAgent: "Modality selector",
  tppGeneratorAgent: "TPP generator",
  targetRiskScorerAgent: "Target risk",
  indPackageAssemblerAgent: "IND assembler",
};

export function humanizeStep(step: string): string {
  if (STEP_LABELS[step]) return STEP_LABELS[step];
  const base = step.replace(/:[0-9a-f-]{36}$/i, "").replace(/:.*$/, "");
  if (STEP_LABELS[base]) return STEP_LABELS[base];
  return step.replace(/_/g, " ").replace(/:/g, " · ");
}

export function humanizeAgent(agent: string): string {
  return AGENT_LABELS[agent] ?? agent.replace(/Agent$/, "").replace(/([A-Z])/g, " $1").trim();
}

export function sourceTypeLabel(type: TrailSourceType): string {
  switch (type) {
    case "pubmed":
      return "PubMed";
    case "clinicaltrials":
      return "ClinicalTrials.gov";
    case "patent":
      return "Patent";
    case "cohort":
      return "Cohort";
    case "fda":
      return "FDA";
    case "internal":
      return "Internal";
    default:
      return "Source";
  }
}

export function filterTrailForHypothesis(
  entries: AgentTrailEntry[],
  hypothesisId?: string
): AgentTrailEntry[] {
  if (!hypothesisId) return entries;
  return entries.filter(
    (e) => !e.hypothesis_id || e.hypothesis_id === hypothesisId
  );
}

export function deriveCurrentTrailActivity(
  entries: AgentTrailEntry[]
): AgentTrailEntry | null {
  const started = [...entries]
    .filter((e) => e.kind === "started")
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  if (!started.length) return null;
  const latest = started[started.length - 1];
  const completed = entries.some(
    (e) =>
      e.kind === "completed" &&
      e.step === latest.step &&
      (e.hypothesis_id ?? null) === (latest.hypothesis_id ?? null) &&
      e.timestamp >= latest.timestamp
  );
  return completed ? null : latest;
}
