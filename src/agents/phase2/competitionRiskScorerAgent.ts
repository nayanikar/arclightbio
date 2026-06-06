import type { HypothesisRecord, OpportunityObject } from "@/types/OpportunityObject";
import { buildPhase2Context, runRiskScorer } from "./helpers";
import { upsertIndRegulatoryPackage } from "@/lib/v3Db";

const SYSTEM = `Score COMPETITION risk (0=low, 1=high): crowded mechanism space, fast-follower threat, pipeline density in indication.`;

export async function competitionRiskScorerAgent(
  obj: OpportunityObject,
  hypothesis: HypothesisRecord
): Promise<number> {
  const ctx = buildPhase2Context(obj, hypothesis);
  const { score } = await runRiskScorer(ctx, "competition", SYSTEM);
  await upsertIndRegulatoryPackage(obj.id, hypothesis.id, {
    risk_components: { competition: score },
  });
  return score;
}
