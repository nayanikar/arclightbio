import type { HypothesisRecord, OpportunityObject } from "@/types/OpportunityObject";
import { buildPhase2Context, runRiskScorer } from "./helpers";
import { upsertIndRegulatoryPackage } from "@/lib/v3Db";

const SYSTEM = `Score OTHER residual risk (0=low, 1=high): regulatory unpredictability, geopolitical supply chain, partnership dependency, unclassified program risks.`;

export async function otherRiskScorerAgent(
  obj: OpportunityObject,
  hypothesis: HypothesisRecord
): Promise<number> {
  const ctx = buildPhase2Context(obj, hypothesis);
  const { score } = await runRiskScorer(ctx, "other", SYSTEM);
  await upsertIndRegulatoryPackage(obj.id, hypothesis.id, {
    risk_components: { other: score },
  });
  return score;
}
