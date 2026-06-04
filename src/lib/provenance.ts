import { createHash } from "crypto";
import type { EvidenceCard, OpportunityObject } from "@/types/OpportunityObject";
import type { AgentName } from "@/types/OpportunityObject";
import type { RegulatoryPackage } from "@/types/RegulatoryPackage";

export function sha256(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

export function buildProvenanceTrail(
  cards: EvidenceCard[]
): RegulatoryPackage["provenance_trail"] {
  return cards
    .filter((c) => !c.is_challenge)
    .map((card) => ({
      claim: card.is_cross_domain
        ? `[CROSS-DOMAIN] ${card.content.slice(0, 180)}`
        : card.content.slice(0, 200),
      source_chain: [card.source_url].filter(Boolean),
      retrieval_method: `Live API fetch via ${card.source_type}`,
      agent: card.contributing_agent as AgentName,
      timestamp: card.timestamp,
      raw_api_response_hash: sha256(JSON.stringify(card.raw_source_metadata)),
    }));
}

export function versionLockHash(obj: OpportunityObject): string {
  const snapshot = {
    id: obj.id,
    version: obj.version,
    hypothesis: obj.hypothesis,
    evidence_cards: obj.evidence_cards,
    confidence_score: obj.confidence_score,
  };
  return sha256(JSON.stringify(snapshot));
}

export function buildProvenanceGraph(cards: EvidenceCard[]) {
  return cards
    .filter((c) => !c.is_challenge)
    .map((card) => ({
      id: card.id,
      claim: card.content.slice(0, 120),
      agent: card.contributing_agent,
      source: card.source_url,
      sourceType: card.source_type,
      timestamp: card.timestamp,
      children: [
        {
          label: "Retrieval",
          value: `Live ${card.source_type} API`,
        },
        {
          label: "Agent",
          value: card.contributing_agent,
        },
      ],
    }));
}
