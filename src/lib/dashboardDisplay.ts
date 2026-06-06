import type {
  ActionabilityZone,
  OpportunityObject,
  OpportunityStatus,
} from "@/types/OpportunityObject";
import {
  formatUpdatedAgoShort,
  formatUserQuery,
  getUniqueAgents,
  truncate,
} from "@/lib/dashboardLayout";

export { filterDashboardOpportunities } from "@/lib/dashboardLayout";
import { shortenForField } from "@/lib/compressProse";
import { parentDomainLabel } from "@/lib/parentDomains";
import { buildProgramSummaryDisplay } from "@/lib/programSummary";
import type { ProgramTrustLabel } from "@/lib/programTrustScore";
import { humanizeStep } from "@/lib/trailLabels";

export type DashboardSortKey = "confidence" | "recency" | "phase";
export type DashboardSortDirection = "asc" | "desc";

const PHASE_ORDER: string[] = [
  "phase1:population",
  "phase1:anchors",
  "phase1:market_size",
  "phase1:cd1",
  "phase1:cd2",
  "phase1:expert_domains",
  "phase1:biology_recurrence",
  "phase1:association_filter",
  "phase1:literature_review",
  "phase1:context_mine",
  "phase1:association_generate",
  "phase1:causation_filter",
  "phase1:selectivity_filter",
  "phase1:selectivity_rank",
  "phase1:selectivity_targets",
  "phase1:complete",
  "phase2:target_screen",
  "phase2:drug_check",
  "phase2:ip_fto",
  "phase2:druggability",
  "phase2:modality",
  "phase2:tpp",
  "phase2:risk_scores",
  "phase2:ind_package",
  "phase2:complete",
];

export interface DashboardProgramView {
  id: string;
  title: string;
  subtitle: string;
  confidence: number;
  confidenceLabel: string;
  zone: ActionabilityZone;
  status: OpportunityStatus;
  phaseLabel: string | null;
  phaseOrder: number;
  domainLabel: string | null;
  evidenceCount: number;
  challengeCount: number;
  updatedAgo: string;
  updatedAt: string;
  serial: number;
  isRunning: boolean;
  agentCount: number;
  schemaVersion: 1 | 2 | 3;
  trustLabel: ProgramTrustLabel | null;
}

export interface DashboardMetrics {
  programs: number;
  running: number;
  paused: number;
  actNow: number;
  tooEarly: number;
  crowded: number;
  avgConfidence: number;
}

export function resolveConfidence(opp: OpportunityObject): number {
  if (opp.schema_version === 3 && opp.program_trust_score != null) {
    return opp.program_trust_score;
  }
  return opp.confidence_score;
}

export function resolveTitle(opp: OpportunityObject): string {
  if (opp.schema_version === 3) {
    const summary = buildProgramSummaryDisplay(opp);
    if (summary.trim()) return summary.trim();
  }
  if (opp.schema_version === 3 && opp.program_hypothesis_sentence?.trim()) {
    return opp.program_hypothesis_sentence.trim();
  }
  if (opp.hypothesis.statement?.trim()) {
    return opp.hypothesis.statement.trim();
  }
  return formatUserQuery(opp.search_query);
}

export function getPhaseOrder(phase: string | null | undefined): number {
  if (!phase) return -1;
  const base = phase.replace(/:[0-9a-f-]{36}$/i, "");
  const idx = PHASE_ORDER.indexOf(base);
  return idx >= 0 ? idx : PHASE_ORDER.length;
}

function resolveSubtitle(
  opp: OpportunityObject,
  title: string,
  phaseLabel: string | null
): string {
  const query = opp.search_query?.trim() ?? "";
  const titleNorm = title.trim().toLowerCase();
  const queryNorm = query.toLowerCase();

  if (query && queryNorm !== titleNorm && !titleNorm.includes(queryNorm)) {
    return truncate(query, 100);
  }

  const unmet = opp.hypothesis.unmet_need?.trim();
  if (unmet) return shortenForField(unmet, 18);

  if (phaseLabel) return phaseLabel;

  return truncate(formatUserQuery(opp.search_query), 100);
}

export function toDashboardProgramView(
  opp: OpportunityObject,
  serialById: Map<string, number>
): DashboardProgramView {
  const title = resolveTitle(opp);
  const phaseLabel = opp.v3_phase ? humanizeStep(opp.v3_phase) : null;

  return {
    id: opp.id,
    title: truncate(title, 90),
    subtitle: resolveSubtitle(opp, title, phaseLabel),
    confidence: resolveConfidence(opp),
    confidenceLabel:
      opp.schema_version === 3 && opp.program_trust_score != null
        ? "discovery confidence"
        : "confidence",
    zone: opp.actionability_zone,
    status: opp.status,
    phaseLabel,
    phaseOrder: getPhaseOrder(opp.v3_phase),
    domainLabel: opp.parent_domain
      ? parentDomainLabel(opp.parent_domain)
      : null,
    evidenceCount: opp.evidence_cards.length,
    challengeCount: opp.challenges.length,
    updatedAgo: formatUpdatedAgoShort(opp.last_updated),
    updatedAt: opp.last_updated,
    serial: serialById.get(opp.id) ?? 0,
    isRunning: opp.status === "agents_running",
    agentCount: getUniqueAgents(opp.evidence_cards).length,
    schemaVersion: (opp.schema_version ?? 1) as 1 | 2 | 3,
    trustLabel: opp.program_trust_breakdown?.label ?? null,
  };
}

export function buildDashboardProgramViews(
  opportunities: OpportunityObject[]
): DashboardProgramView[] {
  const serialOrder = [...opportunities].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const serialById = new Map(
    serialOrder.map((opp, index) => [opp.id, index + 1])
  );

  return opportunities.map((opp) => toDashboardProgramView(opp, serialById));
}

export function computeDashboardMetrics(
  opportunities: OpportunityObject[]
): DashboardMetrics {
  const programs = opportunities.length;
  const running = opportunities.filter(
    (o) => o.status === "agents_running"
  ).length;
  const paused = opportunities.filter((o) => o.status === "paused").length;
  const actNow = opportunities.filter(
    (o) => o.actionability_zone === "act_now"
  ).length;
  const tooEarly = opportunities.filter(
    (o) => o.actionability_zone === "too_early"
  ).length;
  const crowded = opportunities.filter(
    (o) => o.actionability_zone === "crowded"
  ).length;
  const avgConfidence =
    programs > 0
      ? Math.round(
          (opportunities.reduce((sum, o) => sum + resolveConfidence(o), 0) /
            programs) *
            100
        )
      : 0;

  return {
    programs,
    running,
    paused,
    actNow,
    tooEarly,
    crowded,
    avgConfidence,
  };
}

export function sortDashboardPrograms(
  views: DashboardProgramView[],
  key: DashboardSortKey,
  direction: DashboardSortDirection = "desc"
): DashboardProgramView[] {
  const sorted = [...views].sort((a, b) => {
    let cmp = 0;

    switch (key) {
      case "confidence":
        cmp = a.confidence - b.confidence;
        break;
      case "recency":
        cmp =
          new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        break;
      case "phase":
        cmp = a.phaseOrder - b.phaseOrder;
        break;
    }

    if (cmp === 0) {
      cmp = a.title.localeCompare(b.title);
    }

    return direction === "desc" ? -cmp : cmp;
  });

  return sorted;
}
