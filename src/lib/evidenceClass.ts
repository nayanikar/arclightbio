import type { EvidenceClass } from "@/types/MechanisticChain";
import type { AgentName, EvidenceCard } from "@/types/OpportunityObject";

const CAUSATION_PATTERNS = [
  /\bknockout\b/i,
  /\bknockdown\b/i,
  /\bko mouse\b/i,
  /\bcrispr\b/i,
  /\bmendelian\b/i,
  /\bcausal\b/i,
  /\bgene deletion\b/i,
  /\bgenetically modified\b/i,
];

const INTERVENTION_PATTERNS = [
  /\bphase [123]\b/i,
  /\brandomized\b/i,
  /\bclinical trial\b/i,
  /\bin vivo treatment\b/i,
  /\bdrug(?:ged|ging)\b/i,
  /\binhibitor treatment\b/i,
  /\bagonist treatment\b/i,
  /\bantagonist treatment\b/i,
  /\btherapeutic intervention\b/i,
];

const ASSOCIATION_PATTERNS = [
  /\bgwas\b/i,
  /\bgenome-wide\b/i,
  /\bobservational\b/i,
  /\bcorrelat/i,
  /\bassociated with\b/i,
  /\bopen targets\b/i,
];

export function inferEvidenceClass(
  card: Pick<EvidenceCard, "content" | "contributing_agent" | "source_type" | "is_novelty_check">
): EvidenceClass {
  const content = card.content;
  const agent = card.contributing_agent;

  if (agent === "clinical_trial" && !card.is_novelty_check) {
    return "intervention";
  }

  if (INTERVENTION_PATTERNS.some((re) => re.test(content))) {
    return "intervention";
  }

  if (CAUSATION_PATTERNS.some((re) => re.test(content))) {
    return "causation";
  }

  if (
    agent === "mechanism" ||
    ASSOCIATION_PATTERNS.some((re) => re.test(content))
  ) {
    return "association";
  }

  if (agent === "literature" || agent === "rwe_signal") {
    return "association";
  }

  return "association";
}

export const EVIDENCE_CLASS_WEIGHT: Record<EvidenceClass, number> = {
  intervention: 1.0,
  causation: 0.7,
  association: 0.4,
};

export function getCardEvidenceClass(card: EvidenceCard): EvidenceClass {
  const stored = card.raw_source_metadata?.evidence_class;
  if (
    stored === "association" ||
    stored === "causation" ||
    stored === "intervention"
  ) {
    return stored;
  }
  return inferEvidenceClass(card);
}

export function summarizeEvidenceClasses(cards: EvidenceCard[]): {
  association: number;
  causation: number;
  intervention: number;
} {
  const counts = { association: 0, causation: 0, intervention: 0 };
  for (const c of cards) {
    if (c.is_challenge || c.contributing_agent === "regulatory") continue;
    const cls = getCardEvidenceClass(c);
    counts[cls] += 1;
  }
  return counts;
}

export function evidenceClassLabel(cls: EvidenceClass): string {
  switch (cls) {
    case "intervention":
      return "Intervention";
    case "causation":
      return "Causation";
    default:
      return "Association";
  }
}

export function agentDefaultClass(agent: AgentName): EvidenceClass {
  if (agent === "clinical_trial") return "intervention";
  if (agent === "mechanism") return "association";
  return "association";
}
