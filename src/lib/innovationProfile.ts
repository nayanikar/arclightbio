import type { InnovationLevel } from "@/types/V3Pipeline";

export type InnovationStepKind = "generate" | "filter" | "narrative";

const LEVEL_LABELS: Record<InnovationLevel, string> = {
  lowest: "Lowest Risk",
  medium: "Medium Risk, Medium Innovation",
  highest: "Highest Risk, Highest Innovation",
};

const GENERATION_TEMP: Record<InnovationLevel, number> = {
  lowest: 0.3,
  medium: 0.6,
  highest: 0.95,
};

const FILTER_TEMP: Record<InnovationLevel, number> = {
  lowest: 0.2,
  medium: 0.4,
  highest: 0.7,
};

const NARRATIVE_TEMP: Record<InnovationLevel, number> = {
  lowest: 0.35,
  medium: 0.55,
  highest: 0.85,
};

export function normalizeInnovationLevel(
  value: string | null | undefined
): InnovationLevel {
  if (value === "lowest" || value === "medium" || value === "highest") {
    return value;
  }
  return "medium";
}

export function innovationLevelLabel(level: InnovationLevel): string {
  return LEVEL_LABELS[level];
}

export function getInnovationTemperature(
  level: InnovationLevel,
  stepKind: InnovationStepKind
): number {
  switch (stepKind) {
    case "generate":
      return GENERATION_TEMP[level];
    case "filter":
      return FILTER_TEMP[level];
    case "narrative":
      return NARRATIVE_TEMP[level];
  }
}

export function innovationFunnelSystemAddon(level: InnovationLevel): string {
  switch (level) {
    case "lowest":
      return `Innovation directive (LOWEST RISK): Prefer precedent-backed, clinically proximate, and literature-supported mechanisms. Penalize speculative cross-domain leaps unless strongly anchored to cohort biology. Favor hypotheses an experienced clinician would already consider plausible.`;
    case "medium":
      return `Innovation directive (MEDIUM): Balance novel cross-context associations with mechanistic plausibility. Include some non-obvious links, but each must remain falsifiable with a clear experimental path.`;
    case "highest":
      return `Innovation directive (HIGHEST): Prioritize non-obvious, cross-domain, weak-literature hypotheses that experts would NOT default to. Reward surprising but falsifiable mechanisms derived from cohort patterns and cross-context seeds. Weak literature support is acceptable if mechanistically coherent. Explicitly avoid "textbook" hypotheses unless they reveal a genuinely new angle.`;
  }
}

export function innovationDiscoveryAddon(level: InnovationLevel): string {
  switch (level) {
    case "lowest":
      return `Discovery mindset: Emphasize established biology and de-risked reasoning. Surface only modestly non-obvious insights backed by precedent.`;
    case "medium":
      return `Discovery mindset: Surface thought-provoking cross-domain patterns. Highlight associations an expert might overlook but can still evaluate mechanistically.`;
    case "highest":
      return `Discovery mindset: Surface hypotheses an expert would not already hold. Weak literature support is acceptable if mechanistically falsifiable. Label speculative claims clearly. Favor brainstorming value over consensus safety.`;
  }
}

export function biologyRecurrenceBand(level: InnovationLevel): {
  min: number;
  max: number;
} {
  switch (level) {
    case "lowest":
      return { min: 0.35, max: 0.55 };
    case "medium":
      return { min: 0.25, max: 0.5 };
    case "highest":
      return { min: 0.15, max: 0.45 };
  }
}

export function innovationPromptBlock(level: InnovationLevel): string {
  return `Innovation level: ${innovationLevelLabel(level)}
${innovationFunnelSystemAddon(level)}`;
}

export function discoverySystemPrompt(
  base: string,
  obj: { innovation_level?: InnovationLevel | null }
): string {
  const level = normalizeInnovationLevel(obj.innovation_level);
  return `${base}\n\n${innovationDiscoveryAddon(level)}`;
}

export function narrativeTemperature(obj: {
  innovation_level?: InnovationLevel | null;
}): number {
  return getInnovationTemperature(
    normalizeInnovationLevel(obj.innovation_level),
    "narrative"
  );
}

export function funnelAgentConfig(
  obj: { innovation_level?: InnovationLevel | null },
  stepKind: "generate" | "filter" = "generate"
): {
  level: InnovationLevel;
  temperature: number;
  systemAddon: string;
} {
  const level = normalizeInnovationLevel(obj.innovation_level);
  return {
    level,
    temperature: getInnovationTemperature(level, stepKind),
    systemAddon: innovationFunnelSystemAddon(level),
  };
}
