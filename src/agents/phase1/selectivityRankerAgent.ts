import { callAgentJson } from "@/api/anthropic";
import type { OpportunityObject } from "@/types/OpportunityObject";
import type { V3HypothesisRecord } from "@/types/V3Pipeline";
import { listHypothesesByStage, updateV3Hypothesis, updateV3OpportunityFields } from "@/lib/v3Db";
import { sanitizeScientificClaim } from "@/lib/scientificLanguage";
import { funnelAgentConfig } from "@/lib/innovationProfile";
import { getActiveTrailCapture } from "@/lib/trailCapture";
import {
  buildPhase1PromptHeader,
  JSON_ONLY_SUFFIX,
  loadPhase1Context,
} from "./shared";

const SYSTEM = `You are the Selectivity Ranker Agent for Arclight Bio V3 Phase 1.
Rank the 3 selectivity hypotheses with explicit ranking_rationale, especially when scores are close.
Consider mechanistic chain confidence, anchor preservation, and selective feasibility.

Return JSON array ordered best-to-worst:
[{ "id": string, "rank": number (1-3), "ranking_rationale": string }]${JSON_ONLY_SUFFIX}`;

interface RankEntry {
  id: string;
  rank: number;
  ranking_rationale: string;
}

export async function selectivityRankerAgent(
  obj: OpportunityObject
): Promise<V3HypothesisRecord[]> {
  const ctx = await loadPhase1Context(obj);
  const selectivity = await listHypothesesByStage(ctx.id, "selectivity");
  if (selectivity.length === 0) return [];

  const hypBlock = selectivity
    .map(
      (h) =>
        `ID:${h.id} RANK:${h.rank ?? "?"} — ${h.statement}\nDirection: ${h.intervention_direction_hypothesis ?? "n/a"} (${h.direction_status ?? "unknown"})`
    )
    .join("\n\n");

  const funnel = funnelAgentConfig(ctx, "filter");
  let rankings: RankEntry[];
  try {
    rankings = await callAgentJson<RankEntry[]>(
      `${SYSTEM}\n\n${funnel.systemAddon}`,
      `${buildPhase1PromptHeader(ctx)}

Selectivity hypotheses to rank:
${hypBlock}`,
      { temperature: funnel.temperature }
    );
    if (!Array.isArray(rankings)) rankings = [];
  } catch {
    rankings = selectivity.map((h, i) => ({
      id: h.id,
      rank: i + 1,
      ranking_rationale: `Default rank ${i + 1} by chain confidence ${h.mechanistic_chain?.overall_chain_confidence ?? 0.5}.`,
    }));
  }

  const trail = getActiveTrailCapture();
  const rationaleLines: string[] = [];
  for (const entry of rankings) {
    const match = selectivity.find((h) => h.id === entry.id);
    if (!match) continue;
    const rationale = sanitizeScientificClaim(entry.ranking_rationale);
    await updateV3Hypothesis(ctx.id, entry.id, {
      rank: entry.rank,
      ranking_rationale: rationale,
    });
    match.rank = entry.rank;
    match.ranking_rationale = rationale;
    rationaleLines.push(`#${entry.rank}: ${rationale}`);
  }
  if (rationaleLines.length) {
    trail?.setSummary(rationaleLines.join("\n\n"));
  }

  await updateV3OpportunityFields(ctx.id, { v3_phase: "phase1:selectivity_rank" });
  return [...selectivity].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
}
