import { callAgentJson } from "@/api/anthropic";
import type { EvidenceCard, HypothesisRecord } from "@/types/OpportunityObject";
import type { MechanisticChain } from "@/types/MechanisticChain";

const CHAIN_SYSTEM = `You are a drug discovery mechanistic biologist building a causal chain from evidence.
Each edge MUST cite evidence_card_ids from the provided cards — do not invent edges without card support.
Use standard biomedical language. Return valid JSON only.`;

interface ChainPayload {
  nodes: Array<{ id: string; label: string; type: string }>;
  edges: Array<{
    from: string;
    to: string;
    evidence_class: "association" | "causation" | "intervention";
    confidence: number;
    evidence_card_ids: string[];
    rationale: string;
  }>;
  gaps: string[];
}

export async function mechanisticChainAgent(
  hypothesis: HypothesisRecord,
  cards: EvidenceCard[]
): Promise<MechanisticChain> {
  const evidenceCards = cards.filter(
    (c) => !c.is_challenge && c.contributing_agent !== "regulatory"
  );

  const cardBlock = evidenceCards
    .slice(0, 20)
    .map(
      (c) =>
        `[${c.id}] (${c.contributing_agent}) ${c.content.slice(0, 220)}`
    )
    .join("\n");

  const emptyChain = (): MechanisticChain => ({
    nodes: [],
    edges: [],
    overall_chain_confidence: 0,
    gaps: ["Insufficient evidence to construct mechanistic chain."],
    generated_at: new Date().toISOString(),
  });

  if (evidenceCards.length === 0) return emptyChain();

  const userPrompt = `Hypothesis: ${hypothesis.statement}
Patient population: ${hypothesis.patient_population}

Evidence cards (use IDs in evidence_card_ids):
${cardBlock}

Build a mechanistic chain: Gene/Protein → Cell Type → Pathway → Disease Phenotype.
Return JSON:
{
  "nodes": [{ "id": "n1", "label": string, "type": "gene"|"protein"|"cell"|"pathway"|"phenotype" }],
  "edges": [{ "from": "n1", "to": "n2", "evidence_class": "association"|"causation"|"intervention", "confidence": 0-1, "evidence_card_ids": string[], "rationale": string }],
  "gaps": string[] (missing causal links, e.g. "No causal evidence for antagonism → microglial TNF reduction")
}`;

  try {
    const payload = await callAgentJson<ChainPayload>(CHAIN_SYSTEM, userPrompt);
    const validIds = new Set(evidenceCards.map((c) => c.id));
    const edges = (payload.edges ?? []).filter(
      (e) =>
        e.evidence_card_ids?.length > 0 &&
        e.evidence_card_ids.some((id) => validIds.has(id))
    );

    const overall =
      edges.length === 0
        ? 0
        : edges.reduce((prod, e) => prod * (e.confidence ?? 0.5), 1);

    return {
      nodes: (payload.nodes ?? []).map((n) => ({
        id: n.id,
        label: n.label,
        type: (["gene", "protein", "cell", "pathway", "phenotype"].includes(
          n.type
        )
          ? n.type
          : "pathway") as MechanisticChain["nodes"][0]["type"],
      })),
      edges: edges.map((e) => ({
        from: e.from,
        to: e.to,
        evidence_class: e.evidence_class ?? "association",
        confidence: e.confidence ?? 0.5,
        evidence_card_ids: e.evidence_card_ids.filter((id) => validIds.has(id)),
        rationale: e.rationale ?? "",
      })),
      overall_chain_confidence: Math.round(overall * 10000) / 10000,
      gaps: payload.gaps ?? [],
      generated_at: new Date().toISOString(),
    };
  } catch {
    return emptyChain();
  }
}
