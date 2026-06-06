import { callAgentJson } from "@/api/anthropic";
import type { OpportunityObject } from "@/types/OpportunityObject";
import type { CrossContextSeed } from "@/types/V3Pipeline";
import { getAllEvidenceCards } from "@/lib/db";
import { updateV3OpportunityFields } from "@/lib/v3Db";
import { sanitizeScientificClaim } from "@/lib/scientificLanguage";
import { funnelAgentConfig } from "@/lib/innovationProfile";
import {
  buildPhase1PromptHeader,
  formatExpertDomains,
  JSON_ONLY_SUFFIX,
  loadPhase1Context,
} from "./shared";

const SYSTEM = `You are the Cross-Context Hypothesis Miner for Arclight Bio V3 Phase 1.
Find common biology appearing in a different context than the parent domain to seed association hypotheses.

Return JSON array (10-20 seeds):
[{
  "claim": string (falsifiable S-R-O),
  "parent_domain_context": string,
  "expert_domain": string,
  "mechanism_bridge": string,
  "confidence": number (0-1)
}]${JSON_ONLY_SUFFIX}`;

export async function crossContextHypothesisMinerAgent(
  obj: OpportunityObject
): Promise<CrossContextSeed[]> {
  const ctx = await loadPhase1Context(obj);
  const cards = (await getAllEvidenceCards(ctx.id))
    .filter((c) => c.contributing_agent === "literature")
    .slice(0, 15);

  const litBlock =
    cards.length > 0
      ? cards.map((c) => c.content.slice(0, 200)).join("\n")
      : "No literature cards yet — infer from expert domains.";

  const funnel = funnelAgentConfig(ctx, "generate");
  let seeds: CrossContextSeed[];
  try {
    seeds = await callAgentJson<CrossContextSeed[]>(
      `${SYSTEM}\n\n${funnel.systemAddon}`,
      `${buildPhase1PromptHeader(ctx)}
Expert domains:
${formatExpertDomains(ctx.expert_domains)}

Literature evidence:
${litBlock}`,
      { temperature: funnel.temperature }
    );
    if (!Array.isArray(seeds)) seeds = [];
  } catch {
    seeds = (ctx.expert_domains ?? []).slice(0, 5).map((d) => ({
      claim: `${d.domain} biology may associate with the program phenotype in a non-${ctx.parent_domain ?? "PD"} context.`,
      parent_domain_context: ctx.parent_domain ?? "parent domain",
      expert_domain: d.domain,
      mechanism_bridge: d.description ?? d.rationale ?? d.domain,
      confidence: d.recurrence_rate ?? 0.5,
    }));
  }

  const cross_context_seeds = seeds.slice(0, 20).map((s) => ({
    ...s,
    claim: sanitizeScientificClaim(s.claim),
    mechanism_bridge: sanitizeScientificClaim(s.mechanism_bridge),
    confidence: Math.min(1, Math.max(0, s.confidence ?? 0.5)),
  }));

  await updateV3OpportunityFields(ctx.id, {
    cross_context_seeds,
    v3_phase: "phase1:context_mine",
  });
  return cross_context_seeds;
}
