import type { ParentDomain } from "@/types/V3Pipeline";

export const PARENT_DOMAINS: ParentDomain[] = [
  "oncology",
  "immunology",
  "autoimmune",
  "neurology",
  "cardiology",
  "metabolism",
  "rare_disease",
  "infectious_disease",
  "dermatology",
  "respiratory",
  "nephrology",
  "hepatology",
  "hematology",
  "endocrinology",
  "reproductive_health",
];

export const PARENT_DOMAIN_OPTIONS: Array<{
  value: ParentDomain;
  label: string;
  description: string;
}> = [
  { value: "oncology", label: "Oncology", description: "Solid and hematologic malignancies" },
  { value: "immunology", label: "Immunology", description: "Immune-modulatory disease" },
  { value: "autoimmune", label: "Autoimmune", description: "Autoimmune and inflammatory disease" },
  { value: "neurology", label: "Neurology", description: "CNS and neurodegenerative disease" },
  { value: "cardiology", label: "Cardiology", description: "Heart and vascular disease" },
  { value: "metabolism", label: "Metabolism", description: "Diabetes, obesity, metabolic syndrome" },
  { value: "rare_disease", label: "Rare disease", description: "Orphan indications" },
  { value: "infectious_disease", label: "Infectious disease", description: "Pathogen-driven disease" },
  { value: "dermatology", label: "Dermatology", description: "Skin and inflammatory dermatology" },
  { value: "respiratory", label: "Respiratory", description: "Airway and pulmonary disease" },
  { value: "nephrology", label: "Nephrology", description: "Kidney disease" },
  { value: "hepatology", label: "Hepatology", description: "Liver disease" },
  { value: "hematology", label: "Hematology", description: "Blood and marrow disorders" },
  { value: "endocrinology", label: "Endocrinology", description: "Hormonal and endocrine disease" },
  { value: "reproductive_health", label: "Reproductive health", description: "Reproductive and women's health" },
];

export function isParentDomain(value: string): value is ParentDomain {
  return (PARENT_DOMAINS as readonly string[]).includes(value);
}

export function parentDomainLabel(
  domain: ParentDomain | string | null | undefined
): string {
  if (!domain) return "General";
  return PARENT_DOMAIN_OPTIONS.find((d) => d.value === domain)?.label ?? domain;
}
