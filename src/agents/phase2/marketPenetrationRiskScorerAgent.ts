import type { HypothesisRecord, OpportunityObject } from "@/types/OpportunityObject";
import { buildPhase2Context, runRiskScorer } from "./helpers";
import { upsertIndRegulatoryPackage } from "@/lib/v3Db";

const SYSTEM = `Score MARKET PENETRATION risk (0=low, 1=high): reimbursement, pricing pressure, SOC entrenchment, patient access barriers.`;

export async function marketPenetrationRiskScorerAgent(
  obj: OpportunityObject,
  hypothesis: HypothesisRecord
): Promise<number> {
  const ctx = buildPhase2Context(obj, hypothesis);
  const { score } = await runRiskScorer(ctx, "market_penetration", SYSTEM);
  await upsertIndRegulatoryPackage(obj.id, hypothesis.id, {
    risk_components: { market_penetration: score },
  });
  return score;
}
