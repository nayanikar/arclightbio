import type { DomainContext, IndicationType } from "@/types/OpportunityObject";

export const DOMAIN_CONTEXTS: Array<{
  value: DomainContext;
  label: string;
  description: string;
}> = [
  {
    value: "general",
    label: "General discovery",
    description: "Standard agent configuration",
  },
  {
    value: "oncology first-in-class",
    label: "Oncology — first-in-class",
    description:
      "Cross-domain search, target ranking, novelty check, modality recommendation",
  },
  {
    value: "autoimmune chronic",
    label: "Autoimmune / chronic disease",
    description: "Higher safety bar, sex-specific biology flag, de-risking steps",
  },
  {
    value: "sex-specific biology",
    label: "Women's health",
    description:
      "Immunology × reproductive health cross-domain, hormonal mechanism search",
  },
  {
    value: "rare disease",
    label: "Rare disease",
    description:
      "Lower evidence bar, orphan drug pathway assessment, smaller population sizing",
  },
];

export function domainContextLabel(context: DomainContext | undefined): string {
  const found = DOMAIN_CONTEXTS.find((d) => d.value === context);
  return found?.label ?? "General discovery";
}

export function domainContextToIndicationType(
  context: DomainContext | undefined
): IndicationType {
  switch (context) {
    case "autoimmune chronic":
    case "sex-specific biology":
      return "autoimmune_chronic";
    case "rare disease":
      return "rare_disease";
    case "oncology first-in-class":
    case "general":
    default:
      return "oncology";
  }
}

export interface DomainContextAdjustments {
  mandatory_domains: string[];
  hypothesis_instruction: string;
  target_filter: string;
}

export const DOMAIN_CONTEXT_ADJUSTMENTS: Partial<
  Record<DomainContext, DomainContextAdjustments>
> = {
  "sex-specific biology": {
    mandatory_domains: [
      "hormonal cycle immunology MeSH",
      "pregnancy immune tolerance",
      "sex differences autoimmune disease",
    ],
    hypothesis_instruction:
      "Explicitly address sex as a biological variable. Consider hormonal cycle interactions, pregnancy-related immune shifts, and X-chromosome dosage effects on immune gene expression.",
    target_filter:
      "Prioritize targets with known sex-differential expression",
  },
  "oncology first-in-class": {
    mandatory_domains: [
      "innate immunity cancer",
      "metabolic reprogramming tumor",
      "microbiome cancer resistance",
    ],
    hypothesis_instruction:
      "The hypothesis must name a specific target not currently in clinical development for this indication. First-in-class requires absence of prior art.",
    target_filter: "Exclude targets with any active IND in this indication",
  },
  "autoimmune chronic": {
    mandatory_domains: [
      "regulatory T cell tolerance",
      "cytokine network autoimmunity",
      "gut-immune axis",
    ],
    hypothesis_instruction:
      "For chronic non-fatal indication, regulatory bar is higher. Safety evidence must be weighted equally to efficacy evidence.",
    target_filter:
      "Flag any target with known safety concerns in chronic use",
  },
  "rare disease": {
    mandatory_domains: [
      "orphan drug development",
      "natural history rare disease",
      "patient registry outcomes",
    ],
    hypothesis_instruction:
      "Consider orphan drug pathways, smaller trial populations, and accelerated approval eligibility.",
    target_filter: "Prioritize targets with genetic validation in rare disease",
  },
};

export function getHypothesisInstruction(
  context: DomainContext | undefined
): string | null {
  if (!context || context === "general") return null;
  return DOMAIN_CONTEXT_ADJUSTMENTS[context]?.hypothesis_instruction ?? null;
}
