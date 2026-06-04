import { randomUUID } from "crypto";
import type {
  AgentName,
  Challenge,
  DomainContext,
  EvidenceCard,
  Hypothesis,
  IndicationType,
  OpportunityObject,
  OpportunityStatus,
  QualityScores,
  SurveillanceTags,
  BlackboardState,
} from "@/types/OpportunityObject";
import type { OrganizationContext } from "@/types/OrganizationContext";
import { getSupabaseAdmin, isSupabaseConfigured } from "./supabase";
import * as fileStore from "./fileStore";
import { domainContextToIndicationType } from "./domainContext";
import { sanitizeScientificClaim } from "./scientificLanguage";
import type { DeriskRecommendation } from "@/types/OpportunityObject";

const DEFAULT_ORG_CONTEXTS: OrganizationContext[] = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    org_name: "Pfizer (Demo)",
    org_type: "large_pharma",
    portfolio: {
      approved_assets: ["Vyndaqel", "tafamidis", "Eliquis", "Comirnaty"],
      pipeline_assets: ["gene therapy platform"],
      platforms: ["small molecule", "ADC", "mRNA"],
      therapeutic_areas: ["cardiology", "oncology", "rare disease", "immunology"],
    },
    commercial_weights: {
      market_size_importance: 0.8,
      first_mover_importance: 0.6,
      competitive_moat_importance: 0.7,
      reimbursement_pathway_importance: 0.8,
    },
    risk_tolerance: {
      actionability_lower_threshold: 0.3,
      actionability_upper_threshold: 0.75,
    },
    discovery_horizons: ["asset_extension", "portfolio_combination"],
    surveillance_defaults: {
      scan_frequency_act_now: "daily",
      scan_frequency_too_early: "weekly",
    },
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    org_name: "Helix Therapeutics (Demo)",
    org_type: "biotech_startup",
    portfolio: {
      approved_assets: [],
      pipeline_assets: ["HLX-101"],
      platforms: ["ADC platform"],
      therapeutic_areas: ["rare disease", "cardiology"],
    },
    commercial_weights: {
      market_size_importance: 0.6,
      first_mover_importance: 0.9,
      competitive_moat_importance: 0.8,
      reimbursement_pathway_importance: 0.5,
    },
    risk_tolerance: {
      actionability_lower_threshold: 0.25,
      actionability_upper_threshold: 0.7,
    },
    discovery_horizons: [
      "capability_driven_new_product",
      "asset_extension",
    ],
    surveillance_defaults: {
      scan_frequency_act_now: "daily",
      scan_frequency_too_early: "weekly",
    },
  },
  {
    id: "00000000-0000-0000-0000-000000000003",
    org_name: "Horizon Ventures (Demo)",
    org_type: "vc_fund",
    portfolio: {
      approved_assets: [],
      pipeline_assets: [],
      platforms: [],
      therapeutic_areas: ["oncology", "neurology", "rare disease"],
    },
    commercial_weights: {
      market_size_importance: 0.85,
      first_mover_importance: 0.95,
      competitive_moat_importance: 0.6,
      reimbursement_pathway_importance: 0.4,
    },
    risk_tolerance: {
      actionability_lower_threshold: 0.3,
      actionability_upper_threshold: 0.65,
    },
    discovery_horizons: ["capability_driven_new_product"],
    surveillance_defaults: {
      scan_frequency_act_now: "weekly",
      scan_frequency_too_early: "monthly",
    },
  },
];

const memoryStore = {
  orgContexts: new Map<string, OrganizationContext>(
    DEFAULT_ORG_CONTEXTS.map((o) => [o.id, o])
  ),
};

function defaultQualityScores(): QualityScores {
  return {
    sample_size: 0.5,
    study_design: 0.5,
    source_credibility: 0.5,
    replication: 0.4,
    recency: 0.7,
    composite: 0.5,
  };
}

export async function listOrgContexts(): Promise<OrganizationContext[]> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("org_contexts")
      .select("*")
      .order("org_name", { ascending: true });
    if (error) throw error;
    const mapped = (data ?? []).map(mapOrgContextRow);
    return mapped.length > 0 ? mapped : [...DEFAULT_ORG_CONTEXTS];
  }
  return Array.from(memoryStore.orgContexts.values());
}

export async function getOrgContext(id: string): Promise<OrganizationContext | null> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("org_contexts")
      .select("*")
      .eq("id", id)
      .single();
    if (!error && data) {
      return mapOrgContextRow(data);
    }
    return (
      memoryStore.orgContexts.get(id) ??
      DEFAULT_ORG_CONTEXTS.find((o) => o.id === id) ??
      null
    );
  }
  return memoryStore.orgContexts.get(id) ?? null;
}

function mapOrgContextRow(row: Record<string, unknown>): OrganizationContext {
  return {
    id: row.id as string,
    org_name: row.org_name as string,
    org_type: row.org_type as OrganizationContext["org_type"],
    portfolio: row.portfolio as OrganizationContext["portfolio"],
    commercial_weights: row.commercial_weights as OrganizationContext["commercial_weights"],
    risk_tolerance: row.risk_tolerance as OrganizationContext["risk_tolerance"],
    discovery_horizons: row.discovery_horizons as OrganizationContext["discovery_horizons"],
    surveillance_defaults: row.surveillance_defaults as OrganizationContext["surveillance_defaults"],
  };
}

export async function createOpportunityObject(input: {
  anchor_type: "auto_generated" | "human_prompted";
  hypothesis: Hypothesis;
  org_context_id: string;
  search_query?: string;
  mode?: "speed" | "depth";
  evidence_tier?: OpportunityObject["evidence_tier"];
  query_tier?: OpportunityObject["query_tier"];
  prior_score?: number;
  domain_context?: DomainContext;
}): Promise<OpportunityObject> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const priorScore = input.prior_score ?? 0.45;
  const domainContext = input.domain_context ?? "general";
  const indicationType = domainContextToIndicationType(domainContext);

  const obj: OpportunityObject = {
    id,
    version: 1,
    created_at: now,
    last_updated: now,
    anchor_type: input.anchor_type,
    status: "initialising",
    hypothesis: input.hypothesis,
    confidence_score: Math.round(priorScore * 0.5 * 10000) / 10000,
    actionability_score: 0,
    actionability_zone: "too_early",
    evidence_cards: [],
    challenges: [],
    surveillance_tags: { concept_tags: [], entity_tags: [], signal_tags: [] },
    change_log: [],
    context_update_proposals: [],
    org_context_id: input.org_context_id,
    search_query: input.search_query,
    mode: input.mode ?? "speed",
    evidence_tier: input.evidence_tier,
    query_tier: input.query_tier ?? input.evidence_tier,
    prior_score: priorScore,
    domain_context: domainContext,
    indication_type: indicationType,
  };

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("opportunity_objects").insert({
      id: obj.id,
      version: obj.version,
      anchor_type: obj.anchor_type,
      status: obj.status,
      hypothesis: obj.hypothesis,
      confidence_score: obj.confidence_score,
      actionability_score: obj.actionability_score,
      actionability_zone: obj.actionability_zone,
      surveillance_tags: obj.surveillance_tags,
      change_log: obj.change_log,
      context_update_proposals: obj.context_update_proposals,
      org_context_id: obj.org_context_id,
      search_query: obj.search_query,
      mode: obj.mode,
      evidence_tier: obj.evidence_tier ?? null,
      query_tier: obj.query_tier ?? obj.evidence_tier ?? null,
      prior_score: obj.prior_score ?? null,
      domain_context: obj.domain_context,
      indication_type: obj.indication_type,
    });
    if (error) throw error;
  } else {
    await fileStore.fileStoreCreateOpportunity(obj);
  }

  return obj;
}

export async function getOpportunityObject(
  id: string
): Promise<OpportunityObject | null> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { data: row, error } = await supabase
      .from("opportunity_objects")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !row) return null;

    const { data: cards } = await supabase
      .from("evidence_cards")
      .select("*")
      .eq("opportunity_object_id", id)
      .order("timestamp", { ascending: true });

    return mapOpportunityRow(row, cards ?? []);
  }

  return fileStore.fileStoreGetOpportunity(id);
}

export async function listOpportunityObjects(): Promise<OpportunityObject[]> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("opportunity_objects")
      .select("*")
      .order("last_updated", { ascending: false });
    if (error) throw error;

    const results: OpportunityObject[] = [];
    for (const row of data ?? []) {
      const { data: cards } = await supabase
        .from("evidence_cards")
        .select("*")
        .eq("opportunity_object_id", row.id)
        .order("timestamp", { ascending: true });
      results.push(mapOpportunityRow(row, cards ?? []));
    }
    return results;
  }

  return fileStore.fileStoreListOpportunities();
}

function mapOpportunityRow(
  row: Record<string, unknown>,
  cards: Record<string, unknown>[]
): OpportunityObject {
  const evidenceCards = cards.map(mapEvidenceCardRow);
  const challenges: Challenge[] = evidenceCards
    .filter((c) => c.is_challenge)
    .map((c) => ({
      id: c.id,
      content: c.content,
      flagged_by: "regulatory" as const,
      evidence_card_ref: c.challenge_metadata?.evidence_card_ref ?? "",
      score_impact: c.challenge_metadata?.score_impact ?? 0,
      dimension: c.challenge_metadata?.dimension ?? "composite",
    }));

  return {
    id: row.id as string,
    version: row.version as number,
    created_at: row.created_at as string,
    last_updated: row.last_updated as string,
    anchor_type: row.anchor_type as OpportunityObject["anchor_type"],
    status: row.status as OpportunityStatus,
    hypothesis: row.hypothesis as Hypothesis,
    confidence_score: row.confidence_score as number,
    actionability_score: row.actionability_score as number,
    actionability_zone: row.actionability_zone as OpportunityObject["actionability_zone"],
    evidence_cards: evidenceCards.filter((c) => !c.is_challenge),
    challenges,
    surveillance_tags: row.surveillance_tags as SurveillanceTags,
    change_log: row.change_log as OpportunityObject["change_log"],
    context_update_proposals:
      row.context_update_proposals as OpportunityObject["context_update_proposals"],
    org_context_id: row.org_context_id as string,
    search_query: row.search_query as string | undefined,
    mode: row.mode as "speed" | "depth" | undefined,
    evidence_tier: row.evidence_tier as OpportunityObject["evidence_tier"],
    query_tier:
      row.query_tier != null
        ? (row.query_tier as OpportunityObject["query_tier"])
        : undefined,
    prior_score:
      typeof row.prior_score === "number"
        ? (row.prior_score as number)
        : undefined,
    domain_context:
      (row.domain_context as DomainContext | undefined) ?? "general",
    indication_type:
      (row.indication_type as IndicationType | undefined) ?? "oncology",
    blackboard_state:
      (row.blackboard_state as BlackboardState | undefined) ?? undefined,
  };
}

function mapEvidenceCardRow(row: Record<string, unknown>): EvidenceCard {
  return {
    id: row.id as string,
    content: row.content as string,
    source_url: (row.source_url as string) ?? "",
    source_type: row.source_type as EvidenceCard["source_type"],
    contributing_agent: row.contributing_agent as AgentName,
    timestamp: row.timestamp as string,
    quality_scores: row.quality_scores as QualityScores,
    regulatory_weight: (row.regulatory_weight as number) ?? 0.5,
    raw_source_metadata: (row.raw_source_metadata as Record<string, unknown>) ?? {},
    is_challenge: row.is_challenge as boolean | undefined,
    challenge_metadata: row.challenge_metadata as EvidenceCard["challenge_metadata"],
    is_cross_domain: (row.is_cross_domain as boolean | undefined) ?? false,
    is_target_list: (row.is_target_list as boolean | undefined) ?? false,
    is_modality_card: (row.is_modality_card as boolean | undefined) ?? false,
    is_novelty_check: (row.is_novelty_check as boolean | undefined) ?? false,
    derisk_recommendation: row.derisk_recommendation as EvidenceCard["derisk_recommendation"],
  };
}

export async function updateOpportunityObject(
  id: string,
  updates: Partial<{
    status: OpportunityStatus;
    confidence_score: number;
    actionability_score: number;
    actionability_zone: OpportunityObject["actionability_zone"];
    hypothesis: Hypothesis;
    surveillance_tags: SurveillanceTags;
    change_log: OpportunityObject["change_log"];
    evidence_tier: OpportunityObject["evidence_tier"];
    query_tier: OpportunityObject["query_tier"];
    prior_score: number;
    blackboard_state: BlackboardState;
  }>
): Promise<void> {
  const payload = { ...updates, last_updated: new Date().toISOString() };

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("opportunity_objects")
      .update(payload)
      .eq("id", id);
    if (error) throw error;
  } else {
    await fileStore.fileStoreUpdateOpportunity(id, payload);
  }
}

function sanitizeDeriskRecommendation(
  rec: DeriskRecommendation | undefined
): DeriskRecommendation | undefined {
  if (!rec) return undefined;
  return {
    ...rec,
    study_type: sanitizeScientificClaim(rec.study_type),
    primary_objective: sanitizeScientificClaim(rec.primary_objective),
    patient_population: sanitizeScientificClaim(rec.patient_population),
    primary_endpoint: sanitizeScientificClaim(rec.primary_endpoint),
    estimated_timeline: sanitizeScientificClaim(rec.estimated_timeline),
    estimated_cost_range: sanitizeScientificClaim(rec.estimated_cost_range),
    closes_gap: sanitizeScientificClaim(rec.closes_gap),
    biomarkers_of_efficacy: rec.biomarkers_of_efficacy.map(sanitizeScientificClaim),
    biomarkers_of_safety: rec.biomarkers_of_safety.map(sanitizeScientificClaim),
  };
}

export async function insertEvidenceCard(
  opportunityId: string,
  card: Omit<EvidenceCard, "id" | "timestamp"> & {
    id?: string;
    timestamp?: string;
  }
): Promise<EvidenceCard> {
  const fullCard: EvidenceCard = {
    ...card,
    content: sanitizeScientificClaim(card.content),
    derisk_recommendation: sanitizeDeriskRecommendation(card.derisk_recommendation),
    id: card.id ?? randomUUID(),
    timestamp: card.timestamp ?? new Date().toISOString(),
    quality_scores: card.quality_scores ?? defaultQualityScores(),
    regulatory_weight: card.regulatory_weight ?? card.quality_scores?.composite ?? 0.5,
  };

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("evidence_cards").insert({
      id: fullCard.id,
      opportunity_object_id: opportunityId,
      content: fullCard.content,
      source_url: fullCard.source_url,
      source_type: fullCard.source_type,
      contributing_agent: fullCard.contributing_agent,
      timestamp: fullCard.timestamp,
      quality_scores: fullCard.quality_scores,
      regulatory_weight: fullCard.regulatory_weight,
      raw_source_metadata: fullCard.raw_source_metadata,
      is_challenge: fullCard.is_challenge ?? false,
      challenge_metadata: fullCard.challenge_metadata ?? null,
      is_cross_domain: fullCard.is_cross_domain ?? false,
      is_target_list: fullCard.is_target_list ?? false,
      is_modality_card: fullCard.is_modality_card ?? false,
      is_novelty_check: fullCard.is_novelty_check ?? false,
      derisk_recommendation: fullCard.derisk_recommendation ?? null,
    });
    if (error) throw error;
  } else {
    await fileStore.fileStoreInsertEvidenceCard(opportunityId, fullCard);
  }

  return fullCard;
}

export async function getEvidenceCardsSince(
  opportunityId: string,
  since: string
): Promise<EvidenceCard[]> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("evidence_cards")
      .select("*")
      .eq("opportunity_object_id", opportunityId)
      .gt("timestamp", since)
      .order("timestamp", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapEvidenceCardRow);
  }

  const cards = await fileStore.fileStoreGetEvidenceCards(opportunityId);
  return cards.filter((c) => c.timestamp > since);
}

export async function getAllEvidenceCards(
  opportunityId: string
): Promise<EvidenceCard[]> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("evidence_cards")
      .select("*")
      .eq("opportunity_object_id", opportunityId)
      .order("timestamp", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapEvidenceCardRow);
  }
  return fileStore.fileStoreGetEvidenceCards(opportunityId);
}

export async function getChallengeCount(opportunityId: string): Promise<number> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { count, error } = await supabase
      .from("evidence_cards")
      .select("*", { count: "exact", head: true })
      .eq("opportunity_object_id", opportunityId)
      .eq("is_challenge", true);
    if (error) throw error;
    return count ?? 0;
  }

  const cards = await fileStore.fileStoreGetEvidenceCards(opportunityId);
  return cards.filter((c) => c.is_challenge).length;
}

export async function deleteEvidenceCards(cardIds: string[]): Promise<void> {
  if (cardIds.length === 0) return;

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("evidence_cards")
      .delete()
      .in("id", cardIds);
    if (error) throw error;
  } else {
    await fileStore.fileStoreDeleteEvidenceCards(cardIds);
  }
}

export async function updateEvidenceCard(
  cardId: string,
  updates: Partial<
    Pick<
      EvidenceCard,
      "quality_scores" | "regulatory_weight" | "derisk_recommendation"
    >
  >
): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("evidence_cards")
      .update(updates)
      .eq("id", cardId);
    if (error) throw error;
  } else {
    await fileStore.fileStoreUpdateEvidenceCard(cardId, updates);
  }
}

export type DashboardMetricRow = {
  id: string;
  status: OpportunityStatus;
  actionability_zone: OpportunityObject["actionability_zone"];
  confidence_score: number;
};

export async function fetchDashboardMetricRows(): Promise<DashboardMetricRow[]> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("opportunity_objects")
      .select("id, status, actionability_zone, confidence_score")
      .neq("status", "archived");
    if (error) throw error;
    return (data ?? []) as DashboardMetricRow[];
  }

  const opportunities = await fileStore.fileStoreListOpportunities();
  return opportunities
    .filter((o) => o.status !== "archived")
    .map((o) => ({
      id: o.id,
      status: o.status,
      actionability_zone: o.actionability_zone,
      confidence_score: o.confidence_score,
    }));
}

export async function saveRegulatoryPackage(pkg: Record<string, unknown>): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("regulatory_packages").insert(pkg);
    if (error) throw error;
  } else {
    await fileStore.fileStoreSaveRegulatoryPackage(pkg.id as string, pkg);
  }
}

export { DEFAULT_ORG_CONTEXTS };
