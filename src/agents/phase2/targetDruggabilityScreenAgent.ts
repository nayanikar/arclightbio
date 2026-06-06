import type { HypothesisRecord, OpportunityObject } from "@/types/OpportunityObject";
import { callAgentJson } from "@/api/anthropic";
import {
  listGlobalUndruggableTargets,
  listUndruggableTargets,
  isTargetUndraggable,
} from "@/lib/v3Db";
import type { TargetScreenEntry } from "@/lib/targetDruggabilityGate";
import { buildPhase2Context, contextPrompt } from "./helpers";

const SYSTEM = `You are a target druggability screener for first-in-class drug development.
For each ranked target, assess feasibility across THREE modality classes:
1. small_molecule (NDA) — binding pocket, selectivity, CNS exposure if relevant
2. biologic (BLA) — surface accessibility, immunogenicity, developability
3. adc — target expression, internalization, normal-tissue window

Mark is_undruggable=true ONLY when ALL THREE modality paths are infeasible.
If any modality is viable, is_undruggable=false.

Return valid JSON:
{
  "targets": [{
    "target_name": string,
    "is_undruggable": boolean,
    "failed_modalities": ("small_molecule"|"biologic"|"adc")[],
    "reasoning": string,
    "alternate_intervention": string | null
  }]
}`;

function registryFallback(
  targetName: string,
  registry: Array<{ target_name: string; reasoning: string; alternate_intervention?: string | null }>
): TargetScreenEntry | null {
  if (!isTargetUndraggable(targetName, registry)) return null;
  const entry = registry.find(
    (r) =>
      r.target_name.toLowerCase() === targetName.toLowerCase() ||
      targetName.toLowerCase().includes(r.target_name.toLowerCase())
  );
  return {
    target_name: targetName,
    is_undruggable: true,
    failed_modalities: ["small_molecule", "biologic", "adc"],
    reasoning:
      entry?.reasoning ??
      "Target appears in undruggable registry — all three modality classes deemed infeasible.",
    alternate_intervention: entry?.alternate_intervention ?? null,
  };
}

export async function targetDruggabilityScreenAgent(
  obj: OpportunityObject,
  hypothesis: HypothesisRecord
): Promise<TargetScreenEntry[]> {
  const ctx = buildPhase2Context(obj, hypothesis);
  const ranked = hypothesis.ranked_targets ?? [];
  if (ranked.length === 0) return [];

  const [globalRegistry, sessionRegistry] = await Promise.all([
    listGlobalUndruggableTargets(),
    listUndruggableTargets(obj.id),
  ]);
  const registry = [...sessionRegistry, ...globalRegistry];

  const preScreened: TargetScreenEntry[] = [];
  const needsLlm: typeof ranked = [];

  for (const t of ranked) {
    const name = t.target_name || t.gene_symbol || "";
    const fallback = registryFallback(name, registry);
    if (fallback) {
      const fromGlobal = globalRegistry.some((g) =>
        isTargetUndraggable(name, [g])
      );
      preScreened.push({
        ...fallback,
        reasoning: fromGlobal
          ? `[Global registry] ${fallback.reasoning}`
          : fallback.reasoning,
      });
    } else {
      needsLlm.push(t);
    }
  }

  if (needsLlm.length === 0) return preScreened;

  try {
    const result = await callAgentJson<{ targets: TargetScreenEntry[] }>(
      SYSTEM,
      `${contextPrompt(ctx)}
Screen these ranked targets for druggability across small molecule, biologic, and ADC modalities:
${JSON.stringify(needsLlm.map((t) => ({ target_name: t.target_name, gene_symbol: t.gene_symbol, rationale: t.rationale })))}`,
      { temperature: 0.2 }
    );

    const llmResults = (result.targets ?? []).map((t) => ({
      ...t,
      is_undruggable:
        t.is_undruggable &&
        (t.failed_modalities?.length ?? 0) >= 3,
    }));

    return [...preScreened, ...llmResults];
  } catch {
    const heuristic: TargetScreenEntry[] = needsLlm.map((t) => {
      const name = t.target_name || t.gene_symbol || "unknown";
      const lowFeasibility = t.selectivity_feasibility < 0.15;
      return {
        target_name: name,
        is_undruggable: lowFeasibility,
        failed_modalities: lowFeasibility
          ? (["small_molecule", "biologic", "adc"] as const)
          : [],
        reasoning: lowFeasibility
          ? `Low selectivity feasibility (${t.selectivity_feasibility.toFixed(2)}) — direct modulation unlikely across standard modalities.`
          : `Heuristic screen passed — target retained for drug pipeline pending detailed assessment.`,
        alternate_intervention: lowFeasibility
          ? "Consider upstream/downstream pathway node or PPI disruptor"
          : null,
      };
    });
    return [...preScreened, ...heuristic];
  }
}
