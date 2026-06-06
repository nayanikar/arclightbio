import { randomUUID } from "crypto";
import type { AppendTrailEntryInput, AgentTrailEntry } from "@/types/AgentTrail";
import type { EvidenceCard } from "@/types/OpportunityObject";
import { getAllEvidenceCards, getOpportunityObject } from "@/lib/db";
import { humanizeAgent, humanizeStep } from "@/lib/trailLabels";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isV3SupabaseDbEnabled } from "@/lib/v3Storage";
import * as v3FileStore from "@/lib/v3FileStore";

function rowToEntry(row: Record<string, unknown>): AgentTrailEntry {
  return {
    id: row.id as string,
    opportunity_id: row.opportunity_id as string,
    timestamp: row.timestamp as string,
    step: row.step as string,
    agent: row.agent as string,
    phase: row.phase as AgentTrailEntry["phase"],
    kind: row.kind as AgentTrailEntry["kind"],
    title: row.title as string,
    summary: (row.summary as string | null) ?? undefined,
    sources: (row.sources as AgentTrailEntry["sources"]) ?? [],
    evidence_card_ids: (row.evidence_card_ids as string[]) ?? [],
    hypothesis_id: (row.hypothesis_id as string | null) ?? undefined,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}

function entryToRow(entry: AgentTrailEntry) {
  return {
    id: entry.id,
    opportunity_id: entry.opportunity_id,
    timestamp: entry.timestamp,
    step: entry.step,
    agent: entry.agent,
    phase: entry.phase,
    kind: entry.kind,
    title: entry.title,
    summary: entry.summary ?? null,
    sources: entry.sources ?? [],
    evidence_card_ids: entry.evidence_card_ids ?? [],
    hypothesis_id: entry.hypothesis_id ?? null,
    metadata: entry.metadata ?? {},
  };
}

async function trailTableReady(): Promise<boolean> {
  if (!(await isV3SupabaseDbEnabled())) return false;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("agent_trail_entries").select("id").limit(1);
  if (error?.code === "PGRST205" || error?.message?.includes("agent_trail_entries")) {
    return false;
  }
  return !error;
}

export async function appendTrailEntry(
  opportunityId: string,
  input: AppendTrailEntryInput
): Promise<AgentTrailEntry> {
  const entry: AgentTrailEntry = {
    id: input.id ?? randomUUID(),
    opportunity_id: opportunityId,
    timestamp: input.timestamp ?? new Date().toISOString(),
    step: input.step,
    agent: input.agent,
    phase: input.phase,
    kind: input.kind,
    title: input.title,
    summary: input.summary,
    sources: input.sources ?? [],
    evidence_card_ids: input.evidence_card_ids ?? [],
    hypothesis_id: input.hypothesis_id,
    metadata: input.metadata ?? {},
  };

  if (await trailTableReady()) {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("agent_trail_entries").insert(entryToRow(entry));
    if (error) throw error;
  } else {
    await v3FileStore.fileStoreAppendTrailEntry(entry);
  }

  return entry;
}

export async function listTrailEntries(
  opportunityId: string,
  options: { hypothesisId?: string; limit?: number } = {}
): Promise<AgentTrailEntry[]> {
  let entries: AgentTrailEntry[] = [];

  if (await trailTableReady()) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("agent_trail_entries")
      .select("*")
      .eq("opportunity_id", opportunityId)
      .order("timestamp", { ascending: true });
    if (error) throw error;
    entries = (data ?? []).map((row) => rowToEntry(row as Record<string, unknown>));
  } else {
    entries = await v3FileStore.fileStoreListTrailEntries(opportunityId);
  }

  if (options.hypothesisId) {
    entries = entries.filter(
      (e) => !e.hypothesis_id || e.hypothesis_id === options.hypothesisId
    );
  }

  if (options.limit) {
    entries = entries.slice(-options.limit);
  }

  return entries;
}

export async function listTrailEntriesSince(
  opportunityId: string,
  afterTimestamp: string
): Promise<AgentTrailEntry[]> {
  const all = await listTrailEntries(opportunityId);
  return all.filter((e) => e.timestamp > afterTimestamp);
}

export async function countTrailEntries(opportunityId: string): Promise<number> {
  if (await trailTableReady()) {
    const supabase = getSupabaseAdmin();
    const { count, error } = await supabase
      .from("agent_trail_entries")
      .select("id", { count: "exact", head: true })
      .eq("opportunity_id", opportunityId);
    if (error) throw error;
    return count ?? 0;
  }
  const entries = await v3FileStore.fileStoreListTrailEntries(opportunityId);
  return entries.length;
}

function evidenceToSource(card: EvidenceCard) {
  return {
    label: card.content.slice(0, 80),
    url: card.source_url || "#",
    type:
      card.source_type === "pubmed"
        ? ("pubmed" as const)
        : card.source_type === "clinicaltrials"
          ? ("clinicaltrials" as const)
          : card.source_type === "fda"
            ? ("fda" as const)
            : ("other" as const),
    excerpt: card.content.slice(0, 200),
  };
}

export async function backfillTrailFromArtifacts(
  opportunityId: string
): Promise<AgentTrailEntry[]> {
  const existing = await countTrailEntries(opportunityId);
  if (existing > 0) return listTrailEntries(opportunityId);

  const obj = await getOpportunityObject(opportunityId);
  if (!obj) return [];

  const completed = obj.blackboard_state?.completedSteps ?? [];
  if (!completed.length) return [];

  const entries: AgentTrailEntry[] = [];
  const baseTs = obj.created_at ?? new Date().toISOString();

  for (let i = 0; i < completed.length; i++) {
    const step = completed[i];
    const phase = step.startsWith("phase2:") ? "phase2" : "phase1";
    const hypothesisMatch = step.match(
      /:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
    );
    entries.push({
      id: randomUUID(),
      opportunity_id: opportunityId,
      timestamp: new Date(new Date(baseTs).getTime() + i * 1000).toISOString(),
      step,
      agent: step.split(":").slice(-1)[0] ?? step,
      phase,
      kind: "completed",
      title: humanizeStep(step),
      summary: `Completed step (backfilled from pipeline checkpoint).`,
      hypothesis_id: hypothesisMatch?.[1],
      sources: [],
      evidence_card_ids: [],
      metadata: { backfilled: true },
    });
  }

  const cards = await getAllEvidenceCards(opportunityId);
  for (const card of cards) {
    if (!card.source_url) continue;
    entries.push({
      id: randomUUID(),
      opportunity_id: opportunityId,
      timestamp: card.timestamp,
      step: "evidence_card",
      agent: card.contributing_agent,
      phase: "phase1",
      kind: "source",
      title: "Evidence consulted",
      summary: card.content.slice(0, 300),
      sources: [evidenceToSource(card)],
      evidence_card_ids: [card.id],
      hypothesis_id: card.hypothesis_id,
      metadata: { backfilled: true },
    });
  }

  for (const h of obj.hypotheses ?? []) {
    if (h.ranking_rationale) {
      entries.push({
        id: randomUUID(),
        opportunity_id: opportunityId,
        timestamp: baseTs,
        step: "phase1:selectivity_rank",
        agent: "selectivityRankerAgent",
        phase: "phase1",
        kind: "reasoning",
        title: `Ranking rationale — ${h.statement?.slice(0, 60) ?? "hypothesis"}`,
        summary: h.ranking_rationale,
        hypothesis_id: h.id,
        sources: [],
        evidence_card_ids: [],
        metadata: { backfilled: true },
      });
    }

    for (const dropped of h.dropped_links ?? []) {
      entries.push({
        id: randomUUID(),
        opportunity_id: opportunityId,
        timestamp: baseTs,
        step: "phase1:causation_filter",
        agent: "causationFilterAgent",
        phase: "phase1",
        kind: "reasoning",
        title: `Dropped link at ${dropped.dropped_at_stage}`,
        summary: `${dropped.original_claim}\n\nReason: ${dropped.reason}`,
        hypothesis_id: h.id,
        sources: [],
        evidence_card_ids: [],
        metadata: { backfilled: true },
      });
    }

    for (const edge of h.mechanistic_chain?.edges ?? []) {
      if (!edge.rationale) continue;
      entries.push({
        id: randomUUID(),
        opportunity_id: opportunityId,
        timestamp: baseTs,
        step: "phase1:causation_filter",
        agent: "causationFilterAgent",
        phase: "phase1",
        kind: "reasoning",
        title: `Mechanistic link ${edge.from} → ${edge.to}`,
        summary: edge.rationale,
        hypothesis_id: h.id,
        sources: [],
        evidence_card_ids: edge.evidence_card_ids ?? [],
        metadata: { backfilled: true, evidence_class: edge.evidence_class },
      });
    }
  }

  entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  if (await trailTableReady()) {
    const supabase = getSupabaseAdmin();
    if (entries.length) {
      const { error } = await supabase
        .from("agent_trail_entries")
        .insert(entries.map(entryToRow));
      if (error) throw error;
    }
  } else {
    await v3FileStore.fileStoreSetTrailEntries(opportunityId, entries);
  }

  return entries;
}

export async function getTrailForOpportunity(
  opportunityId: string,
  options: { hypothesisId?: string; since?: string } = {}
): Promise<AgentTrailEntry[]> {
  await backfillTrailFromArtifacts(opportunityId);
  if (options.since) {
    return listTrailEntriesSince(opportunityId, options.since);
  }
  return listTrailEntries(opportunityId, { hypothesisId: options.hypothesisId });
}

export function stepMeta(step: string): {
  agent: string;
  phase: AgentTrailEntry["phase"];
  label: string;
} {
  const hypothesisMatch = step.match(
    /^(.+):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
  );
  const baseStep = hypothesisMatch ? hypothesisMatch[1] : step;

  const agentMap: Record<string, string> = {
    "phase1:population": "patientPopulationAgent",
    "phase1:anchors": "anchorPopulationAgent",
    "phase1:market_size": "marketSizeAgent",
    "phase1:cd1": "cd1PatternAgent",
    "phase1:cd2": "cd2AssociationAgent",
    "phase1:expert_domains": "expertDomainMergerAgent",
    "phase1:biology_recurrence": "biologyRecurrenceScorerAgent",
    "phase1:association_filter": "crossDomainAssociationFilterAgent",
    "phase1:literature_review": "crossDomainLiteratureAgent",
    "phase1:context_mine": "crossContextHypothesisMinerAgent",
    "phase1:association_generate": "associationHypothesisGeneratorAgent",
    "phase1:causation_filter": "causationFilterAgent",
    "phase1:selectivity_filter": "selectivityFilterAgent",
    "phase1:selectivity_rank": "selectivityRankerAgent",
    "phase1:selectivity_targets": "selectivityTargetRankerAgent",
    "phase1:falsification_exp": "falsificationExperimentDesignerAgent",
    "phase2:target_screen": "targetDruggabilityScreenAgent",
    "phase2:drug_check": "existingDrugCheckerAgent",
    "phase2:ip_fto": "ftoAnalysisAgent",
    "phase2:druggability": "druggabilityAssessmentAgent",
    "phase2:modality": "modalitySelectorAgent",
    "phase2:tpp": "tppGeneratorAgent",
    "phase2:risk_scores": "riskOfFailureAggregatorAgent",
    "phase2:ind_package": "indPackageAssemblerAgent",
  };

  let resolvedBase = baseStep;
  if (baseStep.startsWith("phase1:selectivity_targets:")) {
    resolvedBase = "phase1:selectivity_targets";
  } else if (baseStep.startsWith("phase1:falsification_exp:")) {
    resolvedBase = "phase1:falsification_exp";
  } else if (baseStep.startsWith("phase2:")) {
    const parts = baseStep.split(":");
    resolvedBase = `${parts[0]}:${parts[1]}`;
  }

  const agent = agentMap[resolvedBase] ?? resolvedBase;
  const phase: AgentTrailEntry["phase"] = baseStep.startsWith("phase2:")
    ? "phase2"
    : "phase1";

  return {
    agent,
    phase,
    label: humanizeStep(step),
  };
}

export async function recordV3TrailStarted(
  opportunityId: string,
  step: string,
  hypothesisId?: string
): Promise<AgentTrailEntry> {
  const meta = stepMeta(step);
  return appendTrailEntry(opportunityId, {
    step,
    agent: meta.agent,
    phase: meta.phase,
    kind: "started",
    title: meta.label,
    summary: `Starting ${humanizeAgent(meta.agent)}…`,
    hypothesis_id: hypothesisId,
  });
}

export async function recordV3TrailCompleted(
  opportunityId: string,
  step: string,
  options: {
    hypothesisId?: string;
    summary?: string;
    sources?: AgentTrailEntry["sources"];
    evidence_card_ids?: string[];
  } = {}
): Promise<AgentTrailEntry> {
  const meta = stepMeta(step);
  return appendTrailEntry(opportunityId, {
    step,
    agent: meta.agent,
    phase: meta.phase,
    kind: "completed",
    title: meta.label,
    summary: options.summary ?? `${humanizeAgent(meta.agent)} completed.`,
    sources: options.sources,
    evidence_card_ids: options.evidence_card_ids,
    hypothesis_id: options.hypothesisId,
  });
}

export async function recordV3TrailFailed(
  opportunityId: string,
  step: string,
  error: unknown,
  hypothesisId?: string
): Promise<AgentTrailEntry> {
  const meta = stepMeta(step);
  const message = error instanceof Error ? error.message : String(error);
  return appendTrailEntry(opportunityId, {
    step,
    agent: meta.agent,
    phase: meta.phase,
    kind: "failed",
    title: meta.label,
    summary: message,
    hypothesis_id: hypothesisId,
  });
}
