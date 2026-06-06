import type { IndicationType } from "@/types/OpportunityObject";

export interface IndicationRiskWeights {
  safety_weight: number;
  efficacy_weight: number;
  minimum_confidence_for_act_now: number;
}

export const INDICATION_RISK_WEIGHTS: Record<
  IndicationType,
  IndicationRiskWeights
> = {
  oncology: {
    safety_weight: 0.3,
    efficacy_weight: 0.7,
    minimum_confidence_for_act_now: 0.35,
  },
  autoimmune_chronic: {
    safety_weight: 0.5,
    efficacy_weight: 0.5,
    minimum_confidence_for_act_now: 0.5,
  },
  rare_disease: {
    safety_weight: 0.4,
    efficacy_weight: 0.6,
    minimum_confidence_for_act_now: 0.28,
  },
};

export function getIndicationRiskWeights(
  indicationType?: IndicationType | null
): IndicationRiskWeights {
  if (indicationType == null) {
    return INDICATION_RISK_WEIGHTS.autoimmune_chronic;
  }
  return (
    INDICATION_RISK_WEIGHTS[indicationType] ??
    INDICATION_RISK_WEIGHTS.autoimmune_chronic
  );
}
