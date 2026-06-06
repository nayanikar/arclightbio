import { callAgentJson } from "@/api/anthropic";
import type { OpportunityObject } from "@/types/OpportunityObject";
import type { ExpertDomain } from "@/types/V3Pipeline";
import { updateV3OpportunityFields } from "@/lib/v3Db";
import {
  buildPhase1PromptHeader,
  formatExpertDomains,
  JSON_ONLY_SUFFIX,
  loadPhase1Context,
} from "./shared";

const SYSTEM = `You are the Cross-Domain Association Filter Agent for Arclight Bio V3 Phase 1.
Filter expert domains by association relevance to the target population.
Association types to evaluate: disease, organ, molecular.
Return ONLY domains with a mechanistic bridge to the population.

Return JSON array of kept expert domains (same schema as input).${JSON_ONLY_SUFFIX}`;

export async function crossDomainAssociationFilterAgent(
  obj: OpportunityObject
): Promise<ExpertDomain[]> {
  const ctx = await loadPhase1Context(obj);
  const domains = ctx.expert_domains ?? [];
  if (domains.length === 0) return [];

  const population =
    ctx.population_definition?.definition ?? ctx.hypothesis.patient_population;

  let filtered: ExpertDomain[];
  try {
    filtered = await callAgentJson<ExpertDomain[]>(
      SYSTEM,
      `${buildPhase1PromptHeader(ctx)}
Target population: ${population}
Program hypothesis: ${ctx.program_hypothesis_sentence ?? "n/a"}

Expert domains:
${formatExpertDomains(domains)}

Keep domains with explicit disease/organ/molecular bridge to this population.`
    );
    if (!Array.isArray(filtered)) filtered = domains;
  } catch {
    filtered = domains;
  }

  const result = (filtered.length > 0 ? filtered : domains).slice(0, 8);

  await updateV3OpportunityFields(ctx.id, {
    expert_domains: result,
    v3_phase: "phase1:association_filter",
  });
  return result;
}
