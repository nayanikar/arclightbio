import { randomUUID } from "crypto";
import type {
  AgentName,
  Challenge,
  DomainContext,
  EvidenceCard,
  Hypothesis,
  HypothesisRecord,
  IndicationType,
  OpportunityObject,
  OpportunityStatus,
  OpportunityStatusSnapshot,
  OutgroupValidation,
  QualityScores,
  SurveillanceTags,
  BlackboardState,
  ActionabilityZone,
  DeriskRecommendation,
} from "@/types/OpportunityObject";
import type { OrganizationContext } from "@/types/OrganizationContext";
import { getSupabaseAdmin, isSupabaseConfigured } from "./supabase";
import { useV3SupabaseDb } from "./v3Storage";
import * as fileStore from "./fileStore";
import * as v3FileStore from "./v3FileStore";
import { domainContextToIndicationType } from "./domainContext";
import { applyTopHypothesisScores } from "@/lib/hypothesisRanking";
import {
  getActiveHypothesisId,
  placeholderHypothesis,
  applyTopHypothesisListSummary,
} from "./hypothesisContext";
import { sanitizeScientificClaim } from "./scientificLanguage";
import type { DecisionBrief } from "@/types/DecisionBrief";

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

export async function createOpportunityObjectV2(input: {
  anchor_type: "auto_generated" | "human_prompted";
  org_context_id: string;
  search_query: string;
  mode?: "speed" | "depth";
  evidence_tier?: OpportunityObject["evidence_tier"];
  query_tier?: OpportunityObject["query_tier"];
  prior_score?: number;
  domain_context?: DomainContext;
}): Promise<OpportunityObject> {
  const placeholder = placeholderHypothesis(input.search_query);
  const obj = await createOpportunityObject({
    ...input,
    hypothesis: placeholder,
  });

  const v2Fields = {
    schema_version: 2 as const,
    top_hypothesis_id: null,
    outgroup_validation: null,
    hypotheses: [] as HypothesisRecord[],
  };

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("opportunity_objects")
      .update({
        schema_version: 2,
        top_hypothesis_id: null,
        outgroup_validation: null,
      })
      .eq("id", obj.id);
    if (error) throw error;
  } else {
    await fileStore.fileStoreUpdateOpportunity(obj.id, v2Fields);
  }

  return { ...obj, ...v2Fields };
}

export function mapHypothesisRow(row: Record<string, unknown>): HypothesisRecord {
  return {
    id: row.id as string,
    opportunity_object_id: row.opportunity_object_id as string,
    rank: row.rank as number | null,
    is_outgroup: Boolean(row.is_outgroup),
    statement: row.statement as string,
    patient_population: row.patient_population as string,
    unmet_need: row.unmet_need as string,
    org_positioning: row.org_positioning as string,
    source: row.source as HypothesisRecord["source"],
    cross_domain_score:
      typeof row.cross_domain_score === "number"
        ? (row.cross_domain_score as number)
        : null,
    declared_modality: row.declared_modality as HypothesisRecord["declared_modality"],
    regulatory_pathway: row.regulatory_pathway as HypothesisRecord["regulatory_pathway"],
    confidence_score:
      typeof row.confidence_score === "number"
        ? (row.confidence_score as number)
        : null,
    actionability_score:
      typeof row.actionability_score === "number"
        ? (row.actionability_score as number)
        : null,
    actionability_zone: row.actionability_zone as HypothesisRecord["actionability_zone"],
    created_at: row.created_at as string | undefined,
    mechanistic_chain:
      (row.mechanistic_chain as HypothesisRecord["mechanistic_chain"]) ?? null,
    target_alignment:
      (row.target_alignment as HypothesisRecord["target_alignment"]) ?? null,
    evidence_summary:
      (row.evidence_summary as HypothesisRecord["evidence_summary"]) ?? null,
    score_decomposition:
      (row.score_decomposition as HypothesisRecord["score_decomposition"]) ?? null,
    hypothesis_stage:
      (row.hypothesis_stage as HypothesisRecord["hypothesis_stage"]) ?? null,
    parent_hypothesis_id:
      (row.parent_hypothesis_id as string | null | undefined) ?? null,
    falsifiability_statement:
      (row.falsifiability_statement as string | null | undefined) ?? null,
    anchor_type: (row.anchor_type as HypothesisRecord["anchor_type"]) ?? null,
    anchor_linkage: (row.anchor_linkage as string | null | undefined) ?? null,
    dropped_links:
      (row.dropped_links as HypothesisRecord["dropped_links"]) ?? [],
    new_moa_requires_experiment: Boolean(row.new_moa_requires_experiment),
    intervention_direction_hypothesis:
      (row.intervention_direction_hypothesis as string | null | undefined) ?? null,
    direction_status:
      (row.direction_status as HypothesisRecord["direction_status"]) ?? null,
    direction_hypotheses:
      (row.direction_hypotheses as HypothesisRecord["direction_hypotheses"]) ?? [],
    rank_decomposition:
      (row.rank_decomposition as HypothesisRecord["rank_decomposition"]) ?? null,
    ranking_rationale:
      (row.ranking_rationale as string | null | undefined) ?? null,
    ranked_targets:
      (row.ranked_targets as HypothesisRecord["ranked_targets"]) ?? null,
    falsification_experiment:
      (row.falsification_experiment as HypothesisRecord["falsification_experiment"]) ??
      null,
    target_family_context:
      (row.target_family_context as HypothesisRecord["target_family_context"]) ??
      null,
  };
}

export async function listHypotheses(
  opportunityId: string
): Promise<HypothesisRecord[]> {
  if (await useV3SupabaseDb()) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("hypotheses")
      .select("*")
      .eq("opportunity_object_id", opportunityId)
      .order("rank", { ascending: true, nullsFirst: false });
    if (error) throw error;
    const fromDb = (data ?? []).map(mapHypothesisRow);
    if (fromDb.length > 0) return fromDb;

    const { syncV3FileOverlayToSupabase, readV3FileOverlayHypotheses } =
      await import("@/lib/v3Db");
    await syncV3FileOverlayToSupabase(opportunityId);

    const { data: retry, error: retryErr } = await supabase
      .from("hypotheses")
      .select("*")
      .eq("opportunity_object_id", opportunityId)
      .order("rank", { ascending: true, nullsFirst: false });
    if (retryErr) throw retryErr;
    if ((retry ?? []).length > 0) {
      return (retry ?? []).map(mapHypothesisRow);
    }

    return readV3FileOverlayHypotheses(opportunityId);
  }

  if (isSupabaseConfigured()) {
    const fileHyps = await fileStore.fileStoreListHypotheses(opportunityId);
    if (fileHyps.length > 0) return fileHyps;
    const v3Hyps = await v3FileStore.fileStoreListV3Hypotheses(opportunityId);
    if (v3Hyps.length > 0) return v3Hyps as HypothesisRecord[];
  }

  return fileStore.fileStoreListHypotheses(opportunityId);
}

export async function clearHypothesesForOpportunity(
  opportunityId: string
): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("hypotheses")
      .delete()
      .eq("opportunity_object_id", opportunityId);
    if (error) throw error;
    return;
  }
  await fileStore.fileStoreClearHypotheses(opportunityId);
}

export async function createHypothesis(
  opportunityId: string,
  input: Omit<
    HypothesisRecord,
    | "id"
    | "opportunity_object_id"
    | "declared_modality"
    | "regulatory_pathway"
    | "confidence_score"
    | "actionability_score"
    | "actionability_zone"
    | "created_at"
  > & { id?: string }
): Promise<HypothesisRecord> {
  const record: HypothesisRecord = {
    id: input.id ?? randomUUID(),
    opportunity_object_id: opportunityId,
    rank: input.rank ?? null,
    is_outgroup: input.is_outgroup,
    statement: input.statement,
    patient_population: input.patient_population,
    unmet_need: input.unmet_need,
    org_positioning: input.org_positioning,
    source: input.source,
    cross_domain_score: input.cross_domain_score ?? null,
    declared_modality: null,
    regulatory_pathway: null,
    confidence_score: null,
    actionability_score: null,
    actionability_zone: null,
    created_at: new Date().toISOString(),
    hypothesis_stage: input.hypothesis_stage ?? null,
    parent_hypothesis_id: input.parent_hypothesis_id ?? null,
    falsifiability_statement: input.falsifiability_statement ?? null,
    anchor_type: input.anchor_type ?? null,
    anchor_linkage: input.anchor_linkage ?? null,
    dropped_links: input.dropped_links ?? [],
    new_moa_requires_experiment: input.new_moa_requires_experiment ?? false,
    intervention_direction_hypothesis:
      input.intervention_direction_hypothesis ?? null,
    direction_status: input.direction_status ?? null,
    direction_hypotheses: input.direction_hypotheses ?? [],
    rank_decomposition: input.rank_decomposition ?? null,
    ranking_rationale: input.ranking_rationale ?? null,
    ranked_targets: input.ranked_targets ?? null,
    falsification_experiment: input.falsification_experiment ?? null,
    target_family_context: input.target_family_context ?? null,
    mechanistic_chain: input.mechanistic_chain ?? null,
  };

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("hypotheses").insert({
      id: record.id,
      opportunity_object_id: opportunityId,
      rank: record.rank,
      is_outgroup: record.is_outgroup,
      statement: record.statement,
      patient_population: record.patient_population,
      unmet_need: record.unmet_need,
      org_positioning: record.org_positioning,
      source: record.source ?? null,
      cross_domain_score: record.cross_domain_score,
      hypothesis_stage: input.hypothesis_stage ?? null,
      parent_hypothesis_id: input.parent_hypothesis_id ?? null,
      falsifiability_statement: input.falsifiability_statement ?? null,
      anchor_type: input.anchor_type ?? null,
      anchor_linkage: input.anchor_linkage ?? null,
      dropped_links: input.dropped_links ?? [],
      new_moa_requires_experiment: input.new_moa_requires_experiment ?? false,
      intervention_direction_hypothesis:
        input.intervention_direction_hypothesis ?? null,
      direction_status: input.direction_status ?? null,
      direction_hypotheses: input.direction_hypotheses ?? [],
      rank_decomposition: input.rank_decomposition ?? null,
      ranking_rationale: input.ranking_rationale ?? null,
      ranked_targets: input.ranked_targets ?? null,
      falsification_experiment: input.falsification_experiment ?? null,
      target_family_context: input.target_family_context ?? null,
      mechanistic_chain: input.mechanistic_chain ?? null,
    });
    if (error) throw error;
  } else {
    await fileStore.fileStoreCreateHypothesis(opportunityId, record);
  }

  return record;
}

export async function updateHypothesis(
  hypothesisId: string,
  updates: Partial<
    Pick<
      HypothesisRecord,
      | "rank"
      | "declared_modality"
      | "regulatory_pathway"
      | "confidence_score"
      | "actionability_score"
      | "actionability_zone"
      | "cross_domain_score"
      | "mechanistic_chain"
      | "target_alignment"
      | "evidence_summary"
      | "score_decomposition"
      | "hypothesis_stage"
      | "parent_hypothesis_id"
      | "falsifiability_statement"
      | "anchor_type"
      | "anchor_linkage"
      | "dropped_links"
      | "new_moa_requires_experiment"
      | "intervention_direction_hypothesis"
      | "direction_status"
      | "direction_hypotheses"
      | "rank_decomposition"
      | "ranking_rationale"
      | "ranked_targets"
      | "falsification_experiment"
      | "target_family_context"
    >
  >
): Promise<void> {
  if (await useV3SupabaseDb()) {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("hypotheses")
      .update(updates)
      .eq("id", hypothesisId);
    if (error) throw error;
    return;
  }

  await fileStore.fileStoreUpdateHypothesis(hypothesisId, updates);
  const oppId = await fileStore.fileStoreFindOpportunityIdForHypothesis(hypothesisId);
  if (oppId) {
    await v3FileStore.fileStoreUpdateV3Hypothesis(oppId, hypothesisId, updates);
  }
}

export async function getEvidenceCardsForHypothesis(
  hypothesisId: string
): Promise<EvidenceCard[]> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("evidence_cards")
      .select("*")
      .eq("hypothesis_id", hypothesisId)
      .order("timestamp", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapEvidenceCardRow);
  }
  return fileStore.fileStoreGetEvidenceCardsForHypothesis(hypothesisId);
}

export async function getChallengeCountForHypothesis(
  hypothesisId: string
): Promise<number> {
  const cards = await getEvidenceCardsForHypothesis(hypothesisId);
  return cards.filter((c) => c.is_challenge).length;
}

function mapStatusSnapshot(
  row: Record<string, unknown>,
  hypothesisCount: number,
  evidenceCardCount: number,
  pipelineComplete: boolean
): OpportunityStatusSnapshot {
  const schemaVersion = ((row.schema_version as number | undefined) ?? 1) as 1 | 2 | 3;
  return {
    id: row.id as string,
    status: row.status as OpportunityStatus,
    schema_version: schemaVersion,
    search_query: row.search_query as string | undefined,
    confidence_score: row.confidence_score as number,
    actionability_zone: row.actionability_zone as ActionabilityZone,
    last_updated: row.last_updated as string,
    top_hypothesis_id: (row.top_hypothesis_id as string | null | undefined) ?? null,
    blackboard_state: row.blackboard_state as BlackboardState | undefined,
    hypothesis_count: hypothesisCount,
    evidence_card_count: evidenceCardCount,
    pipeline_complete: pipelineComplete,
  };
}

export async function getOpportunityStatus(
  id: string
): Promise<OpportunityStatusSnapshot | null> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { data: row, error } = await supabase
      .from("opportunity_objects")
      .select(
        "id, status, schema_version, search_query, confidence_score, actionability_zone, last_updated, top_hypothesis_id, blackboard_state"
      )
      .eq("id", id)
      .single();
    if (error || !row) return null;

    const schemaVersion = (row.schema_version as number | undefined) ?? 1;

    const { count: cardCount } = await supabase
      .from("evidence_cards")
      .select("*", { count: "exact", head: true })
      .eq("opportunity_object_id", id);

    let hypothesisCount = 0;
    if (schemaVersion === 2 || schemaVersion === 3) {
      const { count: hypCount } = await supabase
        .from("hypotheses")
        .select("*", { count: "exact", head: true })
        .eq("opportunity_object_id", id);
      hypothesisCount = hypCount ?? 0;
    }

    const { isBlackboardV2Complete } = await import("@/lib/blackboardRunV2");
    const { isBlackboardComplete } = await import("@/lib/blackboardRun");
    const { isBlackboardV3Complete } = await import("@/lib/blackboardRunV3");
    const state = row.blackboard_state as BlackboardState | undefined;
    const pipelineComplete =
      schemaVersion === 2
        ? isBlackboardV2Complete(state)
        : schemaVersion === 3
          ? isBlackboardV3Complete(state)
          : isBlackboardComplete(state);

    let rowForSnapshot: Record<string, unknown> = { ...row };
    if (schemaVersion === 2 || schemaVersion === 3) {
      const { data: hypRows } = await supabase
        .from("hypotheses")
        .select("id, confidence_score, actionability_zone, is_outgroup, rank")
        .eq("opportunity_object_id", id)
        .order("rank", { ascending: true });
      const top =
        hypRows?.find((h) => h.id === row.top_hypothesis_id) ??
        hypRows?.find((h) => h.rank === 1) ??
        hypRows?.find((h) => !h.is_outgroup) ??
        hypRows?.[0];
      if (top) {
        rowForSnapshot = {
          ...rowForSnapshot,
          confidence_score: top.confidence_score,
          actionability_zone: top.actionability_zone,
        };
      }
    }

    return mapStatusSnapshot(
      rowForSnapshot,
      hypothesisCount,
      cardCount ?? 0,
      pipelineComplete
    );
  }

  return fileStore.fileStoreGetOpportunityStatus(id);
}

export async function getOpportunityObject(
  id: string,
  options?: { skipRepair?: boolean }
): Promise<OpportunityObject | null> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { data: row, error } = await supabase
      .from("opportunity_objects")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !row) return null;

    const schemaVersion = (row.schema_version as number | undefined) ?? 1;

    const { data: cards } = await supabase
      .from("evidence_cards")
      .select("*")
      .eq("opportunity_object_id", id)
      .order("timestamp", { ascending: true });

    const allCards = cards ?? [];
    const v1Cards =
      schemaVersion === 1
        ? allCards.filter((c) => !c.hypothesis_id)
        : allCards;

    const obj = mapOpportunityRow(row, v1Cards);

    if (schemaVersion === 2 || schemaVersion === 3) {
      const hypotheses = await listHypotheses(id);
      const withCards = await Promise.all(
        hypotheses.map(async (h) => {
          const hCards = allCards.filter(
            (c) => c.hypothesis_id === h.id
          );
          const mapped = hCards.map(mapEvidenceCardRow);
          return {
            ...h,
            evidence_cards: mapped.filter((c) => !c.is_challenge),
            challenges: mapped
              .filter((c) => c.is_challenge)
              .map((c) => ({
                id: c.id,
                content: c.content,
                flagged_by: "regulatory" as const,
                evidence_card_ref: c.challenge_metadata?.evidence_card_ref ?? "",
                score_impact: c.challenge_metadata?.score_impact ?? 0,
                dimension: c.challenge_metadata?.dimension ?? ("composite" as const),
              })),
          };
        })
      );
      obj.hypotheses = withCards;
      obj.evidence_cards = allCards.map(mapEvidenceCardRow).filter((c) => !c.is_challenge);
      obj.challenges = allCards
        .map(mapEvidenceCardRow)
        .filter((c) => c.is_challenge)
        .map((c) => ({
          id: c.id,
          content: c.content,
          flagged_by: "regulatory" as const,
          evidence_card_ref: c.challenge_metadata?.evidence_card_ref ?? "",
          score_impact: c.challenge_metadata?.score_impact ?? 0,
          dimension: c.challenge_metadata?.dimension ?? "composite",
        }));

      const top = withCards.find((h) => h.id === obj.top_hypothesis_id);
      if (top?.confidence_score != null) {
        Object.assign(obj, applyTopHypothesisScores(top));
      }
    }

    if (schemaVersion === 3) {
      const { hydrateV3OpportunityObject, repairV3MisclassifiedFailure } =
        await import("@/lib/v3Db");
      if (!options?.skipRepair && obj.status === "agents_failed") {
        await repairV3MisclassifiedFailure(id);
        return getOpportunityObject(id, { skipRepair: true });
      }
      return hydrateV3OpportunityObject(obj);
    }

    return obj;
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

    const rows = data ?? [];
    if (rows.length === 0) return [];

    const { repairV3MisclassifiedFailure } = await import("@/lib/v3Db");
    const failedV3Ids = rows
      .filter(
        (r) =>
          r.status === "agents_failed" &&
          ((r.schema_version as number | undefined) ?? 1) === 3
      )
      .map((r) => r.id as string);
    if (failedV3Ids.length > 0) {
      await Promise.all(
        failedV3Ids.map((id) => repairV3MisclassifiedFailure(id))
      );
      const { data: refreshed, error: refreshErr } = await supabase
        .from("opportunity_objects")
        .select("*")
        .order("last_updated", { ascending: false });
      if (refreshErr) throw refreshErr;
      rows.splice(0, rows.length, ...(refreshed ?? []));
    }

    const ids = rows.map((r) => r.id as string);

    const { data: allCards } = await supabase
      .from("evidence_cards")
      .select("*")
      .in("opportunity_object_id", ids)
      .order("timestamp", { ascending: true });

    const { data: allHyps } = await supabase
      .from("hypotheses")
      .select("*")
      .in("opportunity_object_id", ids)
      .order("rank", { ascending: true });

    const cardsByOpp = new Map<string, Record<string, unknown>[]>();
    for (const card of allCards ?? []) {
      const oid = card.opportunity_object_id as string;
      const bucket = cardsByOpp.get(oid);
      if (bucket) bucket.push(card);
      else cardsByOpp.set(oid, [card]);
    }

    const hypsByOpp = new Map<string, HypothesisRecord[]>();
    for (const row of allHyps ?? []) {
      const oid = row.opportunity_object_id as string;
      const mapped = mapHypothesisRow(row);
      const bucket = hypsByOpp.get(oid);
      if (bucket) bucket.push(mapped);
      else hypsByOpp.set(oid, [mapped]);
    }

    return rows.map((row) => {
      const id = row.id as string;
      const schemaVersion = (row.schema_version as number | undefined) ?? 1;
      const cards = cardsByOpp.get(id) ?? [];
      let obj = mapOpportunityRow(row, cards);
      if (schemaVersion === 2 || schemaVersion === 3) {
        const hypotheses = hypsByOpp.get(id) ?? [];
        obj = applyTopHypothesisListSummary({ ...obj, hypotheses }, hypotheses);
      }
      return obj;
    });
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
    indication_type: row.indication_type as IndicationType | undefined,
    blackboard_state:
      (row.blackboard_state as BlackboardState | undefined) ?? undefined,
    schema_version: ((row.schema_version as number | undefined) ?? 1) as 1 | 2 | 3,
    top_hypothesis_id: (row.top_hypothesis_id as string | null | undefined) ?? null,
    outgroup_validation:
      (row.outgroup_validation as OutgroupValidation | null | undefined) ?? null,
    decision_brief:
      (row.decision_brief as OpportunityObject["decision_brief"]) ?? null,
    innovation_level:
      (row.innovation_level as OpportunityObject["innovation_level"]) ?? "medium",
    parent_domain:
      (row.parent_domain as OpportunityObject["parent_domain"]) ?? null,
    cohort_id: (row.cohort_id as string | null | undefined) ?? null,
    program_hypothesis_sentence:
      (row.program_hypothesis_sentence as string | null | undefined) ?? null,
    anchor_profiles:
      (row.anchor_profiles as OpportunityObject["anchor_profiles"]) ?? null,
    expert_domains:
      (row.expert_domains as OpportunityObject["expert_domains"]) ?? null,
    selected_phase2_hypothesis_id:
      (row.selected_phase2_hypothesis_id as string | null | undefined) ?? null,
    v3_phase: (row.v3_phase as OpportunityObject["v3_phase"]) ?? null,
    population_definition:
      (row.population_definition as OpportunityObject["population_definition"]) ?? null,
    cd1_patterns: (row.cd1_patterns as OpportunityObject["cd1_patterns"]) ?? null,
    cd2_associations:
      (row.cd2_associations as OpportunityObject["cd2_associations"]) ?? null,
    cross_context_seeds:
      (row.cross_context_seeds as OpportunityObject["cross_context_seeds"]) ?? null,
    program_trust_score:
      typeof row.program_trust_score === "number"
        ? (row.program_trust_score as number)
        : null,
    program_trust_breakdown:
      (row.program_trust_breakdown as OpportunityObject["program_trust_breakdown"]) ?? null,
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
    hypothesis_id: (row.hypothesis_id as string | undefined) ?? undefined,
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
    schema_version: 1 | 2 | 3;
    top_hypothesis_id: string | null;
    outgroup_validation: OutgroupValidation | null;
    decision_brief: DecisionBrief | null;
    search_query: string;
    parent_domain: OpportunityObject["parent_domain"];
    cohort_id: string | null;
    program_hypothesis_sentence: string | null;
    anchor_profiles: OpportunityObject["anchor_profiles"];
    expert_domains: OpportunityObject["expert_domains"];
    selected_phase2_hypothesis_id: string | null;
    v3_phase: OpportunityObject["v3_phase"];
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
  },
  options?: { hypothesisId?: string }
): Promise<EvidenceCard> {
  const fullCard: EvidenceCard = {
    ...card,
    content: sanitizeScientificClaim(card.content),
    derisk_recommendation: sanitizeDeriskRecommendation(card.derisk_recommendation),
    id: card.id ?? randomUUID(),
    timestamp: card.timestamp ?? new Date().toISOString(),
    quality_scores: card.quality_scores ?? defaultQualityScores(),
    regulatory_weight: card.regulatory_weight ?? card.quality_scores?.composite ?? 0.5,
    hypothesis_id: options?.hypothesisId ?? card.hypothesis_id ?? getActiveHypothesisId(),
  };

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("evidence_cards").insert({
      id: fullCard.id,
      opportunity_object_id: opportunityId,
      hypothesis_id: fullCard.hypothesis_id ?? null,
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
  let cards: EvidenceCard[];
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("evidence_cards")
      .select("*")
      .eq("opportunity_object_id", opportunityId)
      .order("timestamp", { ascending: true });
    if (error) throw error;
    cards = (data ?? []).map(mapEvidenceCardRow);
  } else {
    cards = await fileStore.fileStoreGetEvidenceCards(opportunityId);
  }

  const hypothesisId = getActiveHypothesisId();
  if (hypothesisId) {
    return cards.filter((c) => c.hypothesis_id === hypothesisId);
  }
  return cards;
}

/** Stage-1 PubMed / cross-domain cards scoped to the whole discovery program (no hypothesis_id). */
export async function getSharedStage1LiteratureCards(
  opportunityId: string
): Promise<EvidenceCard[]> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("evidence_cards")
      .select("*")
      .eq("opportunity_object_id", opportunityId)
      .is("hypothesis_id", null)
      .order("timestamp", { ascending: true });
    if (error) throw error;
    return (data ?? [])
      .map(mapEvidenceCardRow)
      .filter(
        (c) =>
          !c.is_challenge &&
          (c.contributing_agent === "literature" ||
            c.raw_source_metadata?.cross_domain === true)
      );
  }
  const cards = await fileStore.fileStoreGetEvidenceCards(opportunityId);
  return cards.filter(
    (c) =>
      !c.hypothesis_id &&
      !c.is_challenge &&
      (c.contributing_agent === "literature" ||
        c.raw_source_metadata?.cross_domain === true)
  );
}

export async function getChallengeCount(opportunityId: string): Promise<number> {
  const hypothesisId = getActiveHypothesisId();
  if (hypothesisId) {
    return getChallengeCountForHypothesis(hypothesisId);
  }

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
      | "quality_scores"
      | "regulatory_weight"
      | "derisk_recommendation"
      | "raw_source_metadata"
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
export { createOpportunityObjectV3 } from "./v3Db";
