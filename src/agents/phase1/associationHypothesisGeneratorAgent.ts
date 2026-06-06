import { randomUUID } from "crypto";
import { callAgentJson } from "@/api/anthropic";
import type { OpportunityObject } from "@/types/OpportunityObject";
import type { V3HypothesisRecord } from "@/types/V3Pipeline";
import { saveV3Hypotheses, updateV3OpportunityFields } from "@/lib/v3Db";
import { sanitizeScientificClaim } from "@/lib/scientificLanguage";
import { funnelAgentConfig } from "@/lib/innovationProfile";
import {
  buildPhase1PromptHeader,
  formatAnchorBlock,
  formatExpertDomains,
  JSON_ONLY_SUFFIX,
  loadPhase1Context,
} from "./shared";

const SYSTEM = `You are the Association Hypothesis Generator for Arclight Bio V3 Phase 1.
Generate exactly 50 distinct falsifiable association hypotheses (subject–relationship–outcome).
Each must specify anchor_type (biology|resistance) and anchor_linkage sentence tracing to an anchor statement.

Return JSON array of 50:
[{
  "statement": string,
  "falsifiability_statement": string,
  "anchor_type": "biology"|"resistance",
  "anchor_linkage": string,
  "patient_population": string,
  "unmet_need": string
}]${JSON_ONLY_SUFFIX}`;

interface AssocPayload {
  statement: string;
  falsifiability_statement: string;
  anchor_type: "biology" | "resistance";
  anchor_linkage: string;
  patient_population: string;
  unmet_need: string;
}

export async function associationHypothesisGeneratorAgent(
  obj: OpportunityObject
): Promise<V3HypothesisRecord[]> {
  const ctx = await loadPhase1Context(obj);
  const population =
    ctx.population_definition?.definition ?? ctx.hypothesis.patient_population;
  const seeds = ctx.cross_context_seeds ?? [];

  const funnel = funnelAgentConfig(ctx, "generate");
  let batch: AssocPayload[] = [];
  try {
    batch = await callAgentJson<AssocPayload[]>(
      `${SYSTEM}\n\n${funnel.systemAddon}`,
      `${buildPhase1PromptHeader(ctx)}
${formatAnchorBlock(ctx.anchor_profiles)}
Expert domains: ${formatExpertDomains(ctx.expert_domains)}

Cross-context seeds:
${seeds.map((s) => `- ${s.claim} (${s.expert_domain})`).join("\n")}

Patient population: ${population}
Generate diverse association hypotheses spanning biology and resistance anchors.`,
      { temperature: funnel.temperature }
    );
    if (!Array.isArray(batch)) batch = [];
  } catch {
    batch = [];
  }

  while (batch.length < 50) {
    const i = batch.length;
    const seed = seeds[i % Math.max(seeds.length, 1)];
    batch.push({
      statement: seed
        ? seed.claim
        : `Association hypothesis ${i + 1}: mechanistic factor ${i + 1} may associate with ${ctx.program_hypothesis_sentence ?? "program phenotype"}.`,
      falsifiability_statement: seed?.claim ?? `Factor ${i + 1} association is testable in ${population}.`,
      anchor_type: i % 2 === 0 ? "biology" : "resistance",
      anchor_linkage:
        ctx.anchor_profiles?.[i % 2 === 0 ? "biology" : "resistance"]
          ?.anchor_statement ?? "Anchor linkage pending.",
      patient_population: population,
      unmet_need: ctx.population_definition?.unmet_need ?? ctx.hypothesis.unmet_need,
    });
  }

  const records: V3HypothesisRecord[] = batch.slice(0, 50).map((h, idx) => ({
    id: randomUUID(),
    opportunity_object_id: ctx.id,
    statement: sanitizeScientificClaim(h.statement),
    falsifiability_statement: sanitizeScientificClaim(h.falsifiability_statement),
    anchor_type: h.anchor_type,
    anchor_linkage: sanitizeScientificClaim(h.anchor_linkage),
    patient_population: h.patient_population,
    unmet_need: h.unmet_need,
    org_positioning: "",
    hypothesis_stage: "association",
    parent_hypothesis_id: null,
    rank: idx + 1,
  }));

  await saveV3Hypotheses(ctx.id, records, "association");
  await updateV3OpportunityFields(ctx.id, { v3_phase: "phase1:association_generate" });
  return records;
}
