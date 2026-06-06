import { randomUUID } from "crypto";
import { callAgentJson } from "@/api/anthropic";
import type { OpportunityObject } from "@/types/OpportunityObject";
import type { MechanisticChain } from "@/types/MechanisticChain";
import type { V3HypothesisRecord } from "@/types/V3Pipeline";
import { listHypothesesByStage, saveV3Hypotheses, updateV3OpportunityFields } from "@/lib/v3Db";
import { getAllEvidenceCards } from "@/lib/db";
import { sanitizeScientificClaim } from "@/lib/scientificLanguage";
import { funnelAgentConfig } from "@/lib/innovationProfile";
import { getActiveTrailCapture } from "@/lib/trailCapture";
import {
  buildPhase1PromptHeader,
  JSON_ONLY_SUFFIX,
  loadPhase1Context,
} from "./shared";

const SYSTEM = `You are the Causation Filter Agent for Arclight Bio discovery.
Promote the strongest 20 of 50 association hypotheses to causation stage.
Each promoted hypothesis needs mechanistic_chain with ASSOCIATION and CAUSATION typed edges.

Each statement: one sentence, max 18 words. Edge rationale fields: max 14 words each.

Return JSON:
{
  "promoted_ids": string[],
  "hypotheses": [{
    "id": string,
    "statement": string,
    "falsifiability_statement": string,
    "anchor_type": "biology"|"resistance",
    "anchor_linkage": string,
    "patient_population": string,
    "unmet_need": string,
    "mechanistic_chain": {
      "nodes": [{ "id": string, "label": string, "type": string }],
      "edges": [{ "from": string, "to": string, "evidence_class": "association"|"causation"|"intervention", "confidence": number, "evidence_card_ids": string[], "rationale": string }],
      "gaps": string[]
    }
  }]
}${JSON_ONLY_SUFFIX}`;

interface CausationPayload {
  promoted_ids: string[];
  hypotheses: Array<
    AssocHypothesis & {
      id: string;
      mechanistic_chain: Omit<MechanisticChain, "overall_chain_confidence" | "generated_at">;
    }
  >;
}

type AssocHypothesis = Pick<
  V3HypothesisRecord,
  | "statement"
  | "falsifiability_statement"
  | "anchor_type"
  | "anchor_linkage"
  | "patient_population"
  | "unmet_need"
>;

export async function causationFilterAgent(
  obj: OpportunityObject
): Promise<V3HypothesisRecord[]> {
  const ctx = await loadPhase1Context(obj);
  const associations = await listHypothesesByStage(ctx.id, "association");
  if (associations.length === 0) return [];

  const cards = (await getAllEvidenceCards(ctx.id)).slice(0, 20);
  const trail = getActiveTrailCapture();
  for (const card of cards) {
    if (!card.source_url) continue;
    trail?.addSource({
      label: card.content.slice(0, 60),
      url: card.source_url,
      type:
        card.source_type === "pubmed"
          ? "pubmed"
          : card.source_type === "clinicaltrials"
            ? "clinicaltrials"
            : "other",
      excerpt: card.content.slice(0, 120),
    });
  }
  const cardBlock = cards.map((c) => `[${c.id}] ${c.content.slice(0, 160)}`).join("\n");

  const hypBlock = associations
    .map((h) => `ID:${h.id} — ${h.statement}`)
    .join("\n");

  const funnel = funnelAgentConfig(ctx, "filter");
  let payload: CausationPayload;
  try {
    payload = await callAgentJson<CausationPayload>(
      `${SYSTEM}\n\n${funnel.systemAddon}`,
      `${buildPhase1PromptHeader(ctx)}

Association hypotheses (select best 20):
${hypBlock}

Evidence cards:
${cardBlock || "none"}`,
      { temperature: funnel.temperature }
    );
  } catch {
    const top = associations.slice(0, 20);
    payload = {
      promoted_ids: top.map((h) => h.id),
      hypotheses: top.map((h) => ({
        id: h.id,
        statement: h.statement,
        falsifiability_statement: h.falsifiability_statement,
        anchor_type: h.anchor_type,
        anchor_linkage: h.anchor_linkage,
        patient_population: h.patient_population,
        unmet_need: h.unmet_need,
        mechanistic_chain: {
          nodes: [
            { id: "n1", label: "Molecular driver", type: "protein" },
            { id: "n2", label: "Pathway", type: "pathway" },
            { id: "n3", label: "Phenotype", type: "phenotype" },
          ],
          edges: [
            {
              from: "n1",
              to: "n2",
              evidence_class: "association" as const,
              confidence: 0.6,
              evidence_card_ids: cards.slice(0, 1).map((c) => c.id),
              rationale: "Literature-supported association.",
            },
            {
              from: "n2",
              to: "n3",
              evidence_class: "causation" as const,
              confidence: 0.5,
              evidence_card_ids: cards.slice(1, 2).map((c) => c.id),
              rationale: "Proposed causal link requiring validation.",
            },
          ],
          gaps: ["Interventional evidence needed for causal confirmation."],
        },
      })),
    };
  }

  const selected = payload.hypotheses?.length
    ? payload.hypotheses.slice(0, 20)
    : associations.slice(0, 20).map((h) => ({ ...h, mechanistic_chain: emptyChain() }));

  const records: V3HypothesisRecord[] = selected.map((h, idx) => {
    const parentId = h.id;
    const chain = h.mechanistic_chain ?? emptyChain();
    const edges = chain.edges ?? [];
    const overall =
      edges.length === 0
        ? 0
        : edges.reduce((prod, e) => prod * (e.confidence ?? 0.5), 1);

    return {
      id: randomUUID(),
      opportunity_object_id: ctx.id,
      statement: sanitizeScientificClaim(h.statement),
      falsifiability_statement: sanitizeScientificClaim(
        h.falsifiability_statement ?? h.statement
      ),
      anchor_type: h.anchor_type ?? "biology",
      anchor_linkage: sanitizeScientificClaim(h.anchor_linkage ?? ""),
      patient_population: h.patient_population,
      unmet_need: h.unmet_need,
      org_positioning: "",
      hypothesis_stage: "causation",
      parent_hypothesis_id: parentId,
      rank: idx + 1,
      mechanistic_chain: {
        nodes: (chain.nodes ?? []).map((n) => ({
          id: n.id,
          label: n.label,
          type: (["gene", "protein", "cell", "pathway", "phenotype"].includes(n.type)
            ? n.type
            : "pathway") as MechanisticChain["nodes"][0]["type"],
        })),
        edges: edges.map((e) => ({
          from: e.from,
          to: e.to,
          evidence_class: e.evidence_class ?? "association",
          confidence: e.confidence ?? 0.5,
          evidence_card_ids: e.evidence_card_ids ?? [],
          rationale: e.rationale ?? "",
        })),
        overall_chain_confidence: Math.round(overall * 10000) / 10000,
        gaps: chain.gaps ?? [],
        generated_at: new Date().toISOString(),
      },
    };
  });

  const rationales = records
    .flatMap((r) => r.mechanistic_chain?.edges ?? [])
    .map((e) => e.rationale)
    .filter(Boolean)
    .slice(0, 5);
  trail?.setSummary(
    `Promoted ${records.length} hypotheses to causation stage.${rationales.length ? `\n\nSample mechanistic rationales:\n${rationales.join("\n")}` : ""}`
  );

  await saveV3Hypotheses(ctx.id, records, "causation");
  await updateV3OpportunityFields(ctx.id, { v3_phase: "phase1:causation_filter" });
  return records;
}

function emptyChain(): CausationPayload["hypotheses"][0]["mechanistic_chain"] {
  return { nodes: [], edges: [], gaps: ["Insufficient evidence for mechanistic chain."] };
}
