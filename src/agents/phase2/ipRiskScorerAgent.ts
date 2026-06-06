import type { HypothesisRecord, OpportunityObject } from "@/types/OpportunityObject";
import { buildPhase2Context, runRiskScorer } from "./helpers";
import { upsertIndRegulatoryPackage } from "@/lib/v3Db";

const SYSTEM = `Score IP risk of failure (0=low, 1=high): patent blocking, FTO constraints, freedom to design around existing IP.`;

export async function ipRiskScorerAgent(
  obj: OpportunityObject,
  hypothesis: HypothesisRecord
): Promise<number> {
  const ctx = buildPhase2Context(obj, hypothesis);
  const { score } = await runRiskScorer(ctx, "ip", SYSTEM);
  await upsertIndRegulatoryPackage(obj.id, hypothesis.id, {
    risk_components: { ip: score },
  });
  return score;
}
