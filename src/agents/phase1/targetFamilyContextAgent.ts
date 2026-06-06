import { callAgentJson } from "@/api/anthropic";
import type { OpportunityObject } from "@/types/OpportunityObject";
import type { TargetFamilyContext } from "@/types/V3Pipeline";
import { listHypothesesByStage, updateV3Hypothesis } from "@/lib/v3Db";
import { sanitizeScientificClaim } from "@/lib/scientificLanguage";
import {
  buildPhase1PromptHeader,
  JSON_ONLY_SUFFIX,
  loadPhase1Context,
} from "./shared";
import { discoverySystemPrompt, narrativeTemperature } from "@/lib/innovationProfile";

const SYSTEM = `You are the Target Family Context Agent for Arclight Bio V3 Phase 1.
When a primary target is identified, provide family taxonomy: structure, location, networks, activation, references.

Return JSON:
{
  "target_name": string,
  "family_taxonomy": string,
  "structural_class": string,
  "subcellular_location": string,
  "pathway_networks": string[],
  "activation_mechanism": string,
  "references": string[]
}${JSON_ONLY_SUFFIX}`;

export async function targetFamilyContextAgent(
  obj: OpportunityObject,
  hypothesisId?: string
): Promise<TargetFamilyContext | null> {
  const ctx = await loadPhase1Context(obj);
  const selectivity = await listHypothesesByStage(ctx.id, "selectivity");
  const hypothesis =
    selectivity.find((h) => h.id === hypothesisId) ??
    selectivity.find((h) => h.rank === 1) ??
    selectivity[0];

  if (!hypothesis) return null;

  const primary =
    hypothesis.ranked_targets?.find((t) => t.rank === 1)?.target_name ??
    hypothesis.ranked_targets?.[0]?.target_name;

  if (!primary) return null;

  let family: TargetFamilyContext;
  try {
    family = await callAgentJson<TargetFamilyContext>(
      discoverySystemPrompt(SYSTEM, ctx),
      `${buildPhase1PromptHeader(ctx)}

Hypothesis: ${hypothesis.statement}
Primary target: ${primary}
Ranked targets: ${JSON.stringify(hypothesis.ranked_targets ?? [])}`,
      { temperature: narrativeTemperature(ctx) }
    );
  } catch {
    family = {
      target_name: primary,
      family_taxonomy: `${primary} protein family`,
      structural_class: "Receptor / signaling protein (inferred)",
      subcellular_location: "Membrane-associated (inferred)",
      pathway_networks: ["Innate immunity", "Stress response"],
      activation_mechanism: "Ligand-dependent signaling (requires validation)",
      references: ["Literature review pending"],
    };
  }

  const target_family_context: TargetFamilyContext = {
    ...family,
    target_name: primary,
    family_taxonomy: sanitizeScientificClaim(family.family_taxonomy ?? primary),
    activation_mechanism: family.activation_mechanism
      ? sanitizeScientificClaim(family.activation_mechanism)
      : undefined,
    structural_class: family.structural_class
      ? sanitizeScientificClaim(family.structural_class)
      : undefined,
    references: (family.references ?? []).map(sanitizeScientificClaim),
  };

  await updateV3Hypothesis(ctx.id, hypothesis.id, { target_family_context });
  return target_family_context;
}

export async function targetFamilyContextAgentAll(
  obj: OpportunityObject
): Promise<Awaited<ReturnType<typeof listHypothesesByStage>>> {
  const ctx = await loadPhase1Context(obj);
  const selectivity = await listHypothesesByStage(ctx.id, "selectivity");
  for (const h of selectivity) {
    if (h.ranked_targets?.length) {
      await targetFamilyContextAgent(ctx, h.id);
    }
  }
  return listHypothesesByStage(ctx.id, "selectivity");
}
