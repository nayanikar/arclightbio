import type { EvidenceTier } from "@/types/OpportunityObject";

export const TIER_PRIORS: Record<EvidenceTier, number> = {
  preclinical: 0.15,
  clinical: 0.45,
  established: 0.7,
};

export function tierDisplayLabel(tier: EvidenceTier): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

export function priorScoreForTier(tier: EvidenceTier): number {
  return TIER_PRIORS[tier];
}
