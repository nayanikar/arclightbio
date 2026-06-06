import type { HypothesisRecord, OpportunityObject } from "@/types/OpportunityObject";
import { getIndRegulatoryPackage, upsertIndRegulatoryPackage } from "@/lib/v3Db";

export async function riskOfFailureAggregatorAgent(
  obj: OpportunityObject,
  hypothesis: HypothesisRecord
): Promise<number> {
  const pkg = await getIndRegulatoryPackage(obj.id, hypothesis.id);
  const components = pkg?.risk_components ?? {
    target: 0.5,
    ip: 0.5,
    modality_development: 0.5,
    market_penetration: 0.5,
    infrastructure: 0.5,
    competition: 0.5,
    other: 0.5,
  };

  const values = [
    components.target,
    components.ip,
    components.modality_development,
    components.market_penetration,
    components.infrastructure,
    components.competition,
    components.other,
  ];
  const riskOfFailure =
    Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 1000) / 1000;

  await upsertIndRegulatoryPackage(obj.id, hypothesis.id, {
    risk_of_failure: riskOfFailure,
    risk_components: components,
  });

  return riskOfFailure;
}
