import { callAgentJson } from "@/api/anthropic";
import type { OpportunityObject } from "@/types/OpportunityObject";
import { updateOpportunityObject } from "@/lib/db";
import { updateV3OpportunityFields } from "@/lib/v3Db";
import { ensureGeneratedHeadline, HEADLINE_MAX_WORDS } from "@/lib/headlineProse";
import {
  isPrimaryUndruggable,
  type UndruggableRef,
} from "@/lib/pipelineBlocked";
import { resolveLeadHypothesis } from "@/lib/programSummary";
import { sanitizeScientificClaim } from "@/lib/scientificLanguage";
import { JSON_ONLY_SUFFIX, loadPhase1Context } from "./shared";

const SYSTEM = `You are the Discovery Thesis Agent for Arclight Bio.
Write the program headline: one sentence, max ${HEADLINE_MAX_WORDS} words.

Rules:
- Population-first framing tied to the clinical query; include selective target/modality only when Phase 2 has a druggable path.
- If primary target is undruggable, state that direct modulation is not pursued (no invented drug class).
- Plain language, falsifiable, no ellipsis, no lists.

Return JSON: { "discovery_thesis": string }${JSON_ONLY_SUFFIX}`;

function formatInterventionLine(
  lead: ReturnType<typeof resolveLeadHypothesis>,
  undruggableTargets: UndruggableRef[]
): string | null {
  const ranked = lead?.ranked_targets ?? [];
  if (ranked.length === 0) return null;

  const primary = ranked[0];
  const primaryName = primary.target_name || primary.gene_symbol || "";
  if (primaryName && isPrimaryUndruggable(primaryName, undruggableTargets)) {
    const next = ranked.find((t) => {
      const name = t.target_name || t.gene_symbol || "";
      return name && !isPrimaryUndruggable(name, undruggableTargets);
    });
    if (!next) return "direct target modulation not pursued";
    const name = next.target_name || next.gene_symbol;
    const modality =
      (next as { recommended_modality?: string }).recommended_modality?.trim() ||
      "targeted intervention";
    return `${name} (${modality})`;
  }

  if (!primaryName) return null;
  const modality =
    (primary as { recommended_modality?: string }).recommended_modality?.trim() ||
    "targeted intervention";
  return `${primaryName} (${modality})`;
}

export async function discoveryThesisAgent(obj: OpportunityObject): Promise<string> {
  const ctx = await loadPhase1Context(obj);
  const lead = resolveLeadHypothesis(ctx);
  const undruggable = ctx.undruggable_targets ?? [];
  const intervention = formatInterventionLine(lead, undruggable);

  let thesis: string;
  try {
    const payload = await callAgentJson<{ discovery_thesis: string }>(
      SYSTEM,
      `Clinical query: ${ctx.search_query ?? "n/a"}
Population thesis: ${ctx.program_hypothesis_sentence ?? "n/a"}
Lead selectivity hypothesis: ${lead?.statement ?? "n/a"}
Proposed intervention: ${intervention ?? "not yet defined"}`
    );
    thesis = sanitizeScientificClaim(payload.discovery_thesis);
  } catch {
    thesis = sanitizeScientificClaim(
      ctx.program_hypothesis_sentence?.trim() ||
        lead?.statement?.trim() ||
        ctx.search_query?.trim() ||
        "Discovery program awaiting thesis synthesis."
    );
  }

  thesis = await ensureGeneratedHeadline(
    thesis,
    HEADLINE_MAX_WORDS,
    "discovery thesis program headline"
  );

  await updateV3OpportunityFields(ctx.id, {
    program_hypothesis_sentence: thesis,
  });
  await updateOpportunityObject(ctx.id, {
    hypothesis: {
      ...ctx.hypothesis,
      statement: thesis,
    },
  });

  return thesis;
}
