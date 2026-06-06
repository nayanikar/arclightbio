import { randomUUID } from "crypto";
import { callAgentJson } from "@/api/anthropic";
import type { OpportunityObject } from "@/types/OpportunityObject";
import type { V3HypothesisRecord } from "@/types/V3Pipeline";
import type { HypothesisRecord } from "@/types/OpportunityObject";
import { listHypothesesByStage, saveV3Hypotheses, updateV3OpportunityFields } from "@/lib/v3Db";
import { sanitizeScientificClaim } from "@/lib/scientificLanguage";
import { funnelAgentConfig } from "@/lib/innovationProfile";
import {
  buildPhase1PromptHeader,
  JSON_ONLY_SUFFIX,
  loadPhase1Context,
} from "./shared";

const SYSTEM = `You are the Selectivity Filter Agent for Arclight Bio discovery.
Select exactly 3 causation hypotheses that identify a selective intervention point.
Each must preserve anchor linkage and specify where selectivity is achievable.

Each statement: one sentence, max 18 words. Plain language, not academic prose.

Return JSON:
{
  "selected_ids": string[],
  "hypotheses": [{
    "id": string (parent causation id),
    "statement": string,
    "falsifiability_statement": string,
    "anchor_type": "biology"|"resistance",
    "anchor_linkage": string,
    "patient_population": string,
    "unmet_need": string,
    "intervention_direction_hypothesis": string,
    "direction_status": "supported"|"disputed"|"unsupported"
  }]
}${JSON_ONLY_SUFFIX}`;

interface SelectivityPayload {
  selected_ids: string[];
  hypotheses: Array<
    V3HypothesisRecord & {
      id: string;
    }
  >;
}

export async function selectivityFilterAgent(
  obj: OpportunityObject
): Promise<V3HypothesisRecord[]> {
  const ctx = await loadPhase1Context(obj);
  const causation = await listHypothesesByStage(ctx.id, "causation");
  if (causation.length === 0) return [];

  const hypBlock = causation
    .map(
      (h) =>
        `ID:${h.id} — ${h.statement}\nChain confidence: ${h.mechanistic_chain?.overall_chain_confidence ?? "n/a"}`
    )
    .join("\n\n");

  const funnel = funnelAgentConfig(ctx, "filter");
  let payload: SelectivityPayload;
  try {
    payload = await callAgentJson<SelectivityPayload>(
      `${SYSTEM}\n\n${funnel.systemAddon}`,
      `${buildPhase1PromptHeader(ctx)}

Causation hypotheses (pick 3 with selective intervention points):
${hypBlock}`,
      { temperature: funnel.temperature }
    );
  } catch {
    payload = {
      selected_ids: causation.slice(0, 3).map((h) => h.id),
      hypotheses: causation.slice(0, 3).map((h) => ({
        ...h,
        intervention_direction_hypothesis: `Modulating the causal node in ${h.statement} may selectively alter disease phenotype.`,
        direction_status: "disputed" as const,
      })),
    };
  }

  const source = payload.hypotheses?.length
    ? payload.hypotheses.slice(0, 3)
    : causation.slice(0, 3);

  const records: V3HypothesisRecord[] = source.map((h, idx) => {
    const parent = causation.find((c) => c.id === h.id) ?? causation[idx];
    return {
      id: randomUUID(),
      opportunity_object_id: ctx.id,
      statement: sanitizeScientificClaim(h.statement ?? parent.statement),
      falsifiability_statement: sanitizeScientificClaim(
        h.falsifiability_statement ?? parent.falsifiability_statement ?? parent.statement
      ),
      anchor_type: h.anchor_type ?? parent.anchor_type ?? "biology",
      anchor_linkage: sanitizeScientificClaim(
        h.anchor_linkage ?? parent.anchor_linkage ?? ""
      ),
      patient_population: h.patient_population ?? parent.patient_population,
      unmet_need: h.unmet_need ?? parent.unmet_need,
      org_positioning: "",
      hypothesis_stage: "selectivity",
      parent_hypothesis_id: parent.id,
      mechanistic_chain: parent.mechanistic_chain ?? null,
      intervention_direction_hypothesis: sanitizeScientificClaim(
        h.intervention_direction_hypothesis ??
          `Selective modulation at the causal intervention point may alter ${parent.statement}`
      ),
      direction_status: h.direction_status ?? "disputed",
      rank: idx + 1,
    };
  });

  await saveV3Hypotheses(ctx.id, records, "selectivity");
  await updateV3OpportunityFields(ctx.id, { v3_phase: "phase1:selectivity_filter" });
  return records;
}
