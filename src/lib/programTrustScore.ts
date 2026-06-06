import type { HypothesisRecord } from "@/types/OpportunityObject";
import type { CD2Association, ExpertDomain } from "@/types/V3Pipeline";

export type ProgramTrustLabel = "exploratory" | "moderate" | "strong";

export interface ProgramTrustBreakdown {
  overall: number;
  funnel_coverage: number;
  evidence_strength: number;
  biology_signal: number;
  label: ProgramTrustLabel;
}

const FUNNEL_TARGETS = {
  association: 50,
  causation: 20,
  selectivity: 3,
} as const;

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function trustLabel(overall: number): ProgramTrustLabel {
  if (overall >= 0.7) return "strong";
  if (overall >= 0.45) return "moderate";
  return "exploratory";
}

function funnelCoverage(hypotheses: HypothesisRecord[]): number {
  const nonOutgroup = hypotheses.filter((h) => !h.is_outgroup);
  const association = nonOutgroup.filter((h) => h.hypothesis_stage === "association").length;
  const causation = nonOutgroup.filter((h) => h.hypothesis_stage === "causation").length;
  const selectivity = nonOutgroup.filter(
    (h) => h.hypothesis_stage === "selectivity" || (h.rank != null && h.rank >= 1 && h.rank <= 3)
  ).length;

  const ratios = [
    association / FUNNEL_TARGETS.association,
    causation / FUNNEL_TARGETS.causation,
    selectivity / FUNNEL_TARGETS.selectivity,
  ].map(clamp01);

  return ratios.reduce((sum, r) => sum + r, 0) / ratios.length;
}

function evidenceStrength(selectivityHyps: HypothesisRecord[]): number {
  const ranked = selectivityHyps
    .filter((h) => !h.is_outgroup)
    .filter((h) => h.rank != null && h.rank >= 1 && h.rank <= 3)
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
    .slice(0, 3);

  if (ranked.length === 0) return 0;

  const confidences = ranked.map((h) => h.mechanistic_chain?.overall_chain_confidence ?? 0);
  return confidences.reduce((sum, c) => sum + clamp01(c), 0) / confidences.length;
}

function biologySignal(
  expertDomains: ExpertDomain[] | null | undefined,
  cd2Associations: CD2Association[] | null | undefined
): number {
  const biologyRates = (expertDomains ?? [])
    .map((d) => d.biology_recurrence_rate ?? d.recurrence_rate ?? 0)
    .filter((n) => typeof n === "number" && !Number.isNaN(n));

  if (biologyRates.length > 0) {
    return clamp01(Math.max(...biologyRates));
  }

  const cd2Conf = (cd2Associations ?? [])
    .map((a) => a.confidence ?? 0)
    .filter((n) => typeof n === "number" && !Number.isNaN(n));

  if (cd2Conf.length > 0) {
    return clamp01(Math.max(...cd2Conf));
  }

  return 0;
}

export function computeProgramTrustScore(input: {
  hypotheses: HypothesisRecord[];
  expert_domains?: ExpertDomain[] | null;
  cd2_associations?: CD2Association[] | null;
}): ProgramTrustBreakdown {
  const selectivityHyps = input.hypotheses.filter(
    (h) =>
      !h.is_outgroup &&
      (h.hypothesis_stage === "selectivity" || (h.rank != null && h.rank >= 1 && h.rank <= 3))
  );

  const funnel_coverage = funnelCoverage(input.hypotheses);
  const evidence_strength = evidenceStrength(selectivityHyps);
  const biology_signal = biologySignal(input.expert_domains, input.cd2_associations);

  const overall = clamp01(
    0.35 * funnel_coverage + 0.45 * evidence_strength + 0.2 * biology_signal
  );

  return {
    overall: Math.round(overall * 10000) / 10000,
    funnel_coverage: Math.round(funnel_coverage * 10000) / 10000,
    evidence_strength: Math.round(evidence_strength * 10000) / 10000,
    biology_signal: Math.round(biology_signal * 10000) / 10000,
    label: trustLabel(overall),
  };
}

export const PROGRAM_TRUST_LABELS: Record<
  ProgramTrustLabel,
  { tier: string; hint: string }
> = {
  exploratory: {
    tier: "Exploratory",
    hint: "Early funnel · limited evidence depth",
  },
  moderate: {
    tier: "Moderate",
    hint: "Solid funnel · reasonable evidence",
  },
  strong: {
    tier: "Strong",
    hint: "Full funnel · strong mechanistic signal",
  },
};
