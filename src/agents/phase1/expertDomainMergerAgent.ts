import { callAgentJson } from "@/api/anthropic";
import type { OpportunityObject } from "@/types/OpportunityObject";
import type { ExpertDomain } from "@/types/V3Pipeline";
import { updateV3OpportunityFields } from "@/lib/v3Db";
import { sanitizeScientificClaim } from "@/lib/scientificLanguage";
import {
  buildPhase1PromptHeader,
  JSON_ONLY_SUFFIX,
  loadPhase1Context,
} from "./shared";
import { discoverySystemPrompt, narrativeTemperature } from "@/lib/innovationProfile";

const SYSTEM = `You are the Expert Domain Merger Agent for Arclight Bio V3 Phase 1.
De-duplicate and merge CD1 (cohort patterns) and CD2 (association) into Expert Domains (ED).
Preserve source lineage: cd1, cd2, or merged when both contributed.

Return JSON array:
[{
  "domain": string,
  "source": "cd1"|"cd2"|"merged",
  "description": string,
  "association_types": ("disease"|"organ"|"molecular")[]
}]${JSON_ONLY_SUFFIX}`;

export async function expertDomainMergerAgent(
  obj: OpportunityObject
): Promise<ExpertDomain[]> {
  const ctx = await loadPhase1Context(obj);
  const cd1 = ctx.cd1_patterns ?? [];
  const cd2 = ctx.cd2_associations ?? [];

  if (cd1.length === 0 && cd2.length === 0) {
    await updateV3OpportunityFields(ctx.id, { expert_domains: [] });
    return [];
  }

  let merged: ExpertDomain[];
  try {
    merged = await callAgentJson<ExpertDomain[]>(
      discoverySystemPrompt(SYSTEM, ctx),
      `${buildPhase1PromptHeader(ctx)}

CD1 patterns (from cohort):
${JSON.stringify(cd1, null, 2)}

CD2 associations (literature/target):
${JSON.stringify(cd2, null, 2)}

Merge overlapping domains; keep distinct mechanistic adjacencies separate.`,
      { temperature: narrativeTemperature(ctx) }
    );
    if (!Array.isArray(merged)) merged = [];
  } catch {
    const fromCd1: ExpertDomain[] = cd1.map((p) => ({
      domain: p.domain,
      source: "cd1",
      description: p.pattern,
      association_types: ["disease"],
    }));
    const fromCd2: ExpertDomain[] = cd2.map((a) => ({
      domain: a.domain,
      source: "cd2",
      description: a.association_claim,
      association_types: [a.association_type],
    }));
    merged = [...fromCd1, ...fromCd2];
  }

  const expert_domains = merged.slice(0, 10).map((d) => ({
    ...d,
    description: sanitizeScientificClaim(d.description ?? d.rationale ?? d.domain),
    rationale: d.rationale ? sanitizeScientificClaim(d.rationale) : undefined,
    association_types: d.association_types?.length
      ? d.association_types
      : (["molecular"] as ExpertDomain["association_types"]),
  }));

  await updateV3OpportunityFields(ctx.id, {
    expert_domains,
    v3_phase: "phase1:expert_domains",
  });
  return expert_domains;
}
