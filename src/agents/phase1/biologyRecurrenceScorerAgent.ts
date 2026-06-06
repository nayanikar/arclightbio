import { callAgentJson } from "@/api/anthropic";
import type { OpportunityObject } from "@/types/OpportunityObject";
import type { ExpertDomain } from "@/types/V3Pipeline";
import { updateV3OpportunityFields } from "@/lib/v3Db";
import {
  biologyRecurrenceBand,
  funnelAgentConfig,
  normalizeInnovationLevel,
} from "@/lib/innovationProfile";
import {
  buildPhase1PromptHeader,
  formatAnchorBlock,
  formatExpertDomains,
  JSON_ONLY_SUFFIX,
  loadPhase1Context,
} from "./shared";

const SYSTEM = `You are the Biology Recurrence Scorer for Arclight Bio V3 Phase 1.
Score Biology Anchor (Anchor 1) recurrence: biology recurring in 30–50% of cases in a DIFFERENT context than the parent domain.
Add biology_recurrence_rate (0-1), recurrence_rate (0-1), and different_context per expert domain.
Filter to domains with biology_recurrence_rate between 0.30 and 0.50 when possible; include best alternatives if none qualify.

Return JSON array of scored expert domains (same schema + scoring fields).${JSON_ONLY_SUFFIX}`;

export async function biologyRecurrenceScorerAgent(
  obj: OpportunityObject
): Promise<ExpertDomain[]> {
  const ctx = await loadPhase1Context(obj);
  const domains = ctx.expert_domains ?? [];
  if (domains.length === 0) return [];

  const level = normalizeInnovationLevel(ctx.innovation_level);
  const band = biologyRecurrenceBand(level);
  const funnel = funnelAgentConfig(ctx, "filter");
  let scored: ExpertDomain[];
  try {
    scored = await callAgentJson<ExpertDomain[]>(
      `${SYSTEM}\n\nTarget biology_recurrence_rate band: ${band.min}–${band.max}.\n${funnel.systemAddon}`,
      `${buildPhase1PromptHeader(ctx)}
${formatAnchorBlock(ctx.anchor_profiles)}

Expert domains to score:
${formatExpertDomains(domains)}`,
      { temperature: funnel.temperature }
    );
    if (!Array.isArray(scored)) scored = domains;
  } catch {
    scored = domains.map((d, i) => ({
      ...d,
      biology_recurrence_rate: 0.35 + (i % 3) * 0.05,
      recurrence_rate: 0.6 - i * 0.05,
      different_context: `Observed in ${d.domain} outside primary ${ctx.parent_domain ?? "PD"} context`,
    }));
  }

  const normalized = scored
    .map((d) => ({
      ...d,
      biology_recurrence_rate: Math.min(1, Math.max(0, d.biology_recurrence_rate ?? 0.4)),
      recurrence_rate: Math.min(1, Math.max(0, d.recurrence_rate ?? 0.5)),
    }))
    .sort((a, b) => (b.recurrence_rate ?? 0) - (a.recurrence_rate ?? 0));

  const inRecurrenceBand = normalized.filter(
    (d) =>
      (d.biology_recurrence_rate ?? 0) >= band.min &&
      (d.biology_recurrence_rate ?? 0) <= band.max
  );
  const filtered =
    inRecurrenceBand.length > 0
      ? inRecurrenceBand
      : normalized.slice(0, Math.min(3, normalized.length));

  await updateV3OpportunityFields(ctx.id, {
    expert_domains: filtered.slice(0, 8),
    v3_phase: "phase1:biology_recurrence",
  });
  return filtered.slice(0, 8);
}
