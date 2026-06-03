import type { OpportunityObject } from "@/types/OpportunityObject";

export const OPPORTUNITY_IDS_KEY = "arclight_opportunity_ids";

export interface OpportunitySnapshot {
  id: string;
  query?: string;
  hypothesis_statement: string;
  confidence_score: number;
  actionability_zone: OpportunityObject["actionability_zone"];
  status: OpportunityObject["status"];
  evidence_card_count: number;
  challenge_count: number;
  last_updated: string;
}

export function opportunitySnapshotKey(id: string): string {
  return `arclight_opportunity_${id}`;
}

export function getStoredOpportunityIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(OPPORTUNITY_IDS_KEY);
    const ids = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}

export function appendOpportunityId(id: string): void {
  if (typeof window === "undefined") return;
  const ids = getStoredOpportunityIds();
  if (!ids.includes(id)) {
    localStorage.setItem(OPPORTUNITY_IDS_KEY, JSON.stringify([id, ...ids]));
  }
}

export function snapshotFromOpportunity(
  obj: OpportunityObject
): OpportunitySnapshot {
  return {
    id: obj.id,
    query: obj.search_query,
    hypothesis_statement: obj.hypothesis.statement,
    confidence_score: obj.confidence_score,
    actionability_zone: obj.actionability_zone,
    status: obj.status,
    evidence_card_count: obj.evidence_cards.length,
    challenge_count: obj.challenges.length,
    last_updated: obj.last_updated,
  };
}

export function persistOpportunitySnapshot(obj: OpportunityObject): void {
  if (typeof window === "undefined") return;
  appendOpportunityId(obj.id);
  localStorage.setItem(
    opportunitySnapshotKey(obj.id),
    JSON.stringify(snapshotFromOpportunity(obj))
  );
}

export function clearOpportunityCache(): void {
  if (typeof window === "undefined") return;
  for (const id of getStoredOpportunityIds()) {
    localStorage.removeItem(opportunitySnapshotKey(id));
  }
  localStorage.removeItem(OPPORTUNITY_IDS_KEY);
}

export function persistOpportunitySnapshots(
  opportunities: OpportunityObject[]
): void {
  if (typeof window === "undefined") return;

  const nextIds = opportunities.map((o) => o.id);
  const previousIds = getStoredOpportunityIds();

  for (const id of previousIds) {
    if (!nextIds.includes(id)) {
      localStorage.removeItem(opportunitySnapshotKey(id));
    }
  }

  localStorage.setItem(OPPORTUNITY_IDS_KEY, JSON.stringify(nextIds));

  for (const obj of opportunities) {
    localStorage.setItem(
      opportunitySnapshotKey(obj.id),
      JSON.stringify(snapshotFromOpportunity(obj))
    );
  }
}

export function readOpportunitySnapshot(
  id: string
): OpportunitySnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(opportunitySnapshotKey(id));
    if (!raw) return null;
    return JSON.parse(raw) as OpportunitySnapshot;
  } catch {
    return null;
  }
}

export function snapshotToOpportunity(
  snapshot: OpportunitySnapshot
): OpportunityObject {
  return {
    id: snapshot.id,
    version: 1,
    created_at: snapshot.last_updated,
    last_updated: snapshot.last_updated,
    anchor_type: "human_prompted",
    status: snapshot.status,
    hypothesis: {
      statement: snapshot.hypothesis_statement,
      patient_population: "",
      unmet_need: "",
      org_positioning: "",
    },
    confidence_score: snapshot.confidence_score,
    actionability_score: 0,
    actionability_zone: snapshot.actionability_zone,
    evidence_cards: Array.from({ length: snapshot.evidence_card_count }, (_, i) => ({
      id: `cached-${snapshot.id}-${i}`,
      content: "",
      source_url: "",
      source_type: "pubmed" as const,
      contributing_agent: "literature" as const,
      timestamp: snapshot.last_updated,
      quality_scores: {
        sample_size: 0.5,
        study_design: 0.5,
        source_credibility: 0.5,
        replication: 0.5,
        recency: 0.5,
        composite: 0.5,
      },
      regulatory_weight: 0.5,
      raw_source_metadata: {},
    })),
    challenges: Array.from({ length: snapshot.challenge_count }, (_, i) => ({
      id: `cached-challenge-${snapshot.id}-${i}`,
      content: "",
      flagged_by: "regulatory" as const,
      evidence_card_ref: "",
      score_impact: 0,
      dimension: "composite" as const,
    })),
    surveillance_tags: {
      concept_tags: [],
      entity_tags: [],
      signal_tags: [],
    },
    change_log: [],
    context_update_proposals: [],
    org_context_id: "",
    search_query: snapshot.query,
  };
}

export function rehydrateOpportunitiesFromCache(): OpportunityObject[] {
  return getStoredOpportunityIds()
    .map((id) => readOpportunitySnapshot(id))
    .filter((snapshot): snapshot is OpportunitySnapshot => snapshot !== null)
    .map(snapshotToOpportunity);
}
