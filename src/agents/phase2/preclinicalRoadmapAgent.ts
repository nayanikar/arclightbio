import type { HypothesisRecord, OpportunityObject } from "@/types/OpportunityObject";
import { callAgentJson } from "@/api/anthropic";
import { getIndRegulatoryPackage, upsertIndRegulatoryPackage } from "@/lib/v3Db";
import { buildPhase2Context, contextPrompt } from "./helpers";

const SYSTEM = `You are a preclinical development planner. Design studies that close mechanistic gaps from the hypothesis funnel.
If dropped_links are present, include experiments to test lost anchor connections.
Return valid JSON: { "preclinical_roadmap": string[] }`;

export async function preclinicalRoadmapAgent(
  obj: OpportunityObject,
  hypothesis: HypothesisRecord
): Promise<void> {
  const ctx = buildPhase2Context(obj, hypothesis);
  const existing = await getIndRegulatoryPackage(obj.id, hypothesis.id);

  let roadmap: string[];
  try {
    const result = await callAgentJson<{ preclinical_roadmap: string[] }>(
      SYSTEM,
      `${contextPrompt(ctx)}
Dropped links: ${JSON.stringify(hypothesis.dropped_links ?? [])}
Falsification experiment: ${JSON.stringify(hypothesis.falsification_experiment ?? {})}`
    );
    roadmap = result.preclinical_roadmap;
  } catch {
    roadmap = [
      "In vitro target engagement assay in disease-relevant cell model",
      "In vivo pharmacology in patient-derived xenograft or syngeneic model",
      "Biomarker PD assay development and qualification",
    ];
    if ((hypothesis.dropped_links?.length ?? 0) > 0) {
      roadmap.push(
        "Reconnection experiment: test whether dropped anchor link modulates resistance phenotype"
      );
    }
  }

  await upsertIndRegulatoryPackage(obj.id, hypothesis.id, {
    package: {
      ...(existing?.package ?? {}),
      preclinical_roadmap: roadmap,
    },
  });
}
