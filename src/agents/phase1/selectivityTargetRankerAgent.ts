import { callAgentJson } from "@/api/anthropic";
import { getTargetDiseaseAssociations } from "@/api/openTargets";
import type { OpportunityObject } from "@/types/OpportunityObject";
import type { RankedTarget } from "@/types/V3Pipeline";
import { listHypothesesByStage, listGlobalUndruggableTargets, isTargetUndraggable, updateV3Hypothesis, updateV3OpportunityFields } from "@/lib/v3Db";
import { sanitizeScientificClaim } from "@/lib/scientificLanguage";
import {
  buildPhase1PromptHeader,
  JSON_ONLY_SUFFIX,
  loadPhase1Context,
} from "./shared";

const SYSTEM = `You are the Selectivity Target Ranker for Arclight Bio V3 Phase 1.
For each selectivity hypothesis, rank 3-5 intervention targets.

Return JSON array (one entry per hypothesis):
[{
  "hypothesis_id": string,
  "ranked_targets": [{
    "target_name": string,
    "gene_symbol": string,
    "rank": number,
    "rationale": string,
    "association_strength": number (0-1),
    "causation_strength": number (0-1),
    "selectivity_feasibility": number (0-1)
  }]
}]${JSON_ONLY_SUFFIX}`;

interface TargetRankPayload {
  hypothesis_id: string;
  ranked_targets: RankedTarget[];
}

export async function selectivityTargetRankerAgent(
  obj: OpportunityObject
): Promise<Awaited<ReturnType<typeof listHypothesesByStage>>> {
  const ctx = await loadPhase1Context(obj);
  const selectivity = await listHypothesesByStage(ctx.id, "selectivity");
  if (selectivity.length === 0) return [];

  const undruggableRegistry = await listGlobalUndruggableTargets();

  const query = ctx.search_query ?? ctx.hypothesis.statement;
  const tokenMatch = query.match(/\b([A-Z][A-Z0-9]{1,7})\b/);
  let otBlock = "";
  if (tokenMatch) {
    try {
      const assocs = await getTargetDiseaseAssociations(tokenMatch[1]);
      otBlock = assocs
        .slice(0, 6)
        .map((a) => `${a.targetName}: ${a.diseaseName} (${a.score.toFixed(2)})`)
        .join("\n");
    } catch {
      otBlock = "";
    }
  }

  const hypBlock = selectivity
    .map(
      (h) =>
        `ID:${h.id} — ${h.statement}\nChain: ${h.mechanistic_chain?.edges?.length ?? 0} edges`
    )
    .join("\n\n");

  let payload: TargetRankPayload[];
  try {
    payload = await callAgentJson<TargetRankPayload[]>(
      SYSTEM,
      `${buildPhase1PromptHeader(ctx)}

Selectivity hypotheses:
${hypBlock}

Open Targets context:
${otBlock || "none"}`
    );
    if (!Array.isArray(payload)) payload = [];
  } catch {
    payload = selectivity.map((h, i) => ({
      hypothesis_id: h.id,
      ranked_targets: [
        {
          target_name: tokenMatch?.[1] ?? `Candidate target ${i + 1}`,
          gene_symbol: tokenMatch?.[1],
          rank: 1,
          rationale: "Primary candidate from query token.",
          association_strength: 0.65,
          causation_strength: h.mechanistic_chain?.overall_chain_confidence ?? 0.5,
          selectivity_feasibility: 0.55,
        },
      ],
    }));
  }

  for (const entry of payload) {
    const ranked_targets = (entry.ranked_targets ?? [])
      .filter((t) => !isTargetUndraggable(t.target_name, undruggableRegistry))
      .map((t) => ({
      ...t,
      rationale: sanitizeScientificClaim(t.rationale),
      association_strength: Math.min(1, Math.max(0, t.association_strength ?? 0.5)),
      causation_strength: Math.min(1, Math.max(0, t.causation_strength ?? 0.5)),
      selectivity_feasibility: Math.min(1, Math.max(0, t.selectivity_feasibility ?? 0.5)),
    }));
    await updateV3Hypothesis(ctx.id, entry.hypothesis_id, { ranked_targets });
    const match = selectivity.find((h) => h.id === entry.hypothesis_id);
    if (match) match.ranked_targets = ranked_targets;
  }

  await updateV3OpportunityFields(ctx.id, { v3_phase: "phase1:selectivity_targets" });
  return selectivity;
}
