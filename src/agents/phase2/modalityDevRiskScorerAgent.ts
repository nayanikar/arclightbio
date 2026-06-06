import type { HypothesisRecord, OpportunityObject } from "@/types/OpportunityObject";
import { buildPhase2Context, runRiskScorer } from "./helpers";
import { upsertIndRegulatoryPackage } from "@/lib/v3Db";

const SYSTEM = `Score MODALITY DEVELOPMENT risk (0=low, 1=high): CMC complexity, manufacturing scale-up, formulation, delivery challenges for the selected modality.`;

export async function modalityDevRiskScorerAgent(
  obj: OpportunityObject,
  hypothesis: HypothesisRecord
): Promise<number> {
  const ctx = buildPhase2Context(obj, hypothesis);
  const { score } = await runRiskScorer(ctx, "modality_development", SYSTEM);
  await upsertIndRegulatoryPackage(obj.id, hypothesis.id, {
    risk_components: { modality_development: score },
  });
  return score;
}
