"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import { PageContent } from "@/components/layout/PageContent";
import { V3TopBarActions } from "@/components/opportunity/V3TopBarActions";
import { AnchorProfilesPanel } from "@/components/opportunity/AnchorProfilesPanel";
import { ExpertDomainsPanel } from "@/components/opportunity/ExpertDomainsPanel";
import { HypothesisFunnelPanel } from "@/components/opportunity/HypothesisFunnelPanel";
import { V3SelectivityHypothesesPanel } from "@/components/opportunity/V3SelectivityHypothesesPanel";
import { V3MechanisticChainPanel } from "@/components/opportunity/V3MechanisticChainPanel";
import { TargetFamilyPanel } from "@/components/opportunity/TargetFamilyPanel";
import { V3RankedTargetsPanel } from "@/components/opportunity/V3RankedTargetsPanel";
import { TppBlueprintPanel } from "@/components/opportunity/TppBlueprintPanel";
import { RiskOfFailurePanel } from "@/components/opportunity/RiskOfFailurePanel";
import { IndPackagePanel } from "@/components/opportunity/IndPackagePanel";
import { ProgramTrustBadge } from "@/components/opportunity/ProgramTrustBadge";
import { V3AuditTrailPanel } from "@/components/opportunity/V3AuditTrailPanel";
import { V3LiveAgentActivity } from "@/components/opportunity/V3LiveAgentActivity";
import { V3SessionMetaPills } from "@/components/opportunity/V3SessionMetaPills";
import { V3SectionLabel } from "@/components/opportunity/v3/V3Panel";
import { V3InfoCallout, V3LabeledBlock } from "@/components/opportunity/v3/V3Typography";
import { V3StructuredProse } from "@/components/opportunity/v3/V3StructuredProse";
import { shortenForField } from "@/lib/compressProse";
import { buildProgramSummaryDisplay } from "@/lib/programSummary";
import {
  blockedReason,
  isPipelineBlocked,
  resolvePrimaryTargetName,
} from "@/lib/pipelineBlocked";
import { useAuditTrail } from "@/hooks/useAuditTrail";
import { useOpportunityStore } from "@/store/opportunityStore";
import { useSurveillanceSessionControls } from "@/hooks/useSurveillanceSessionControls";
import type { HypothesisRecord, OpportunityObject } from "@/types/OpportunityObject";
import { cn } from "@/lib/utils";

interface OpportunityPageV3Props {
  obj: OpportunityObject;
  id: string;
  reconnect: () => void;
}

function phase2Candidates(hypotheses: HypothesisRecord[]) {
  return hypotheses
    .filter((h) => !h.is_outgroup)
    .filter(
      (h) =>
        h.hypothesis_stage === "selectivity" ||
        (h.rank != null && h.rank >= 1 && h.rank <= 3)
    )
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
    .slice(0, 3)
    .map((h) => ({ id: h.id, rank: h.rank ?? 0 }));
}

export function OpportunityPageV3({ obj: initialObj, id, reconnect }: OpportunityPageV3Props) {
  const { opportunity, status, blackboardError } = useOpportunityStore();
  const liveObj = opportunity ?? initialObj;
  const {
    pausing,
    resuming,
    pauseError,
    resumeError,
    handlePause,
    handleResume,
  } = useSurveillanceSessionControls();

  const hypotheses = liveObj.hypotheses ?? [];
  const phase2Options = phase2Candidates(hypotheses);

  const defaultSelected =
    liveObj.selected_phase2_hypothesis_id ??
    liveObj.top_hypothesis_id ??
    phase2Options[0]?.id;

  const [selectedId, setSelectedId] = useState<string | undefined>(defaultSelected);
  const [phase2Artifacts, setPhase2Artifacts] = useState<{
    drug_discovery_assessment: OpportunityObject["drug_discovery_assessment"];
    ind_package_v3: OpportunityObject["ind_package_v3"];
  } | null>(null);

  useEffect(() => {
    if (liveObj.selected_phase2_hypothesis_id) {
      setSelectedId(liveObj.selected_phase2_hypothesis_id);
    } else if (liveObj.top_hypothesis_id) {
      setSelectedId(liveObj.top_hypothesis_id);
    }
  }, [liveObj.selected_phase2_hypothesis_id, liveObj.top_hypothesis_id]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    fetch(`/api/opportunity/${id}?hypothesisId=${selectedId}`)
      .then((r) => r.json())
      .then((data: OpportunityObject) => {
        if (cancelled) return;
        setPhase2Artifacts({
          drug_discovery_assessment: data.drug_discovery_assessment ?? null,
          ind_package_v3: data.ind_package_v3 ?? null,
        });
      })
      .catch(() => {
        if (!cancelled) setPhase2Artifacts(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, id, liveObj.last_updated]);

  const handlePhase2Select = (hypId: string) => {
    setSelectedId(hypId);
    void fetch(`/api/opportunity/${id}/phase2-hypothesis`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hypothesisId: hypId }),
    }).catch(() => undefined);
  };

  const handleWorkflowComplete = () => {
    reconnect();
  };

  const selected =
    hypotheses.find((h) => h.id === selectedId) ??
    hypotheses.find((h) => !h.is_outgroup) ??
    hypotheses[0];

  useAuditTrail(selectedId);

  const undruggable = liveObj.undruggable_targets ?? [];
  const primaryTarget = resolvePrimaryTargetName(selected);

  const drugAssessment =
    phase2Artifacts?.drug_discovery_assessment ?? liveObj.drug_discovery_assessment;
  const indPackage = phase2Artifacts?.ind_package_v3 ?? liveObj.ind_package_v3;
  const drugBranch = drugAssessment?.assessment;
  const tpp = drugAssessment?.tpp_blueprint;
  const pipelineBlocked = isPipelineBlocked(
    drugBranch,
    undruggable,
    primaryTarget,
    selected
  );

  const headerSentence = buildProgramSummaryDisplay(liveObj, selected, {
    undruggableTargets: undruggable,
    pipelineBlocked,
  });

  const trustScore =
    liveObj.program_trust_score ?? liveObj.program_trust_breakdown?.overall ?? null;
  const trustBreakdown = liveObj.program_trust_breakdown ?? null;

  const showPhase2 = useMemo(() => {
    const phase = liveObj.v3_phase ?? "";
    return (
      phase.startsWith("phase2:") ||
      drugAssessment != null ||
      indPackage != null
    );
  }, [liveObj.v3_phase, drugAssessment, indPackage]);

  return (
    <>
      <TopBar
        badge={
          <V3TopBarActions
            id={id}
            status={status}
            parentDomain={liveObj.parent_domain}
            searchQuery={liveObj.search_query}
            pausing={pausing}
            resuming={resuming}
            onPause={handlePause}
            onResume={async () => {
              await handleResume();
              if (useOpportunityStore.getState().status === "agents_running") {
                reconnect();
              }
            }}
            onWorkflowComplete={handleWorkflowComplete}
          />
        }
      />

      <PageContent flush>
        {(blackboardError || pauseError || resumeError) && (
          <div className="mb-4 space-y-2">
            {blackboardError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <p className="font-medium">Discovery pipeline failed</p>
                <p className="mt-1 text-xs text-red-700">{blackboardError}</p>
              </div>
            )}
            {pauseError && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
                {pauseError}
              </div>
            )}
            {resumeError && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
                {resumeError}
              </div>
            )}
          </div>
        )}

        <header
          className="v3-hero-grid relative overflow-hidden rounded-xl border px-6 py-8"
          style={{
            borderColor: "rgba(15, 26, 46, 0.1)",
            background:
              "linear-gradient(135deg, var(--v3-navy) 0%, var(--v3-navy-muted) 55%, rgba(26,107,99,0.15) 100%)",
          }}
        >
          <div className="v3-accent-rule absolute inset-x-0 top-0 opacity-80" />
          <div className="flex flex-col gap-5">
            <V3SessionMetaPills
              status={status}
              v3Phase={liveObj.v3_phase}
              parentDomain={liveObj.parent_domain}
              cohortLinked={Boolean(liveObj.cohort_id)}
              innovationLevel={liveObj.innovation_level ?? "medium"}
            />

            <div className="min-w-0">
              <V3SectionLabel>Discovery thesis</V3SectionLabel>
              <h1
                className="mt-1 font-display text-xl font-semibold leading-snug text-balance sm:text-2xl lg:text-[1.65rem]"
                style={{ color: "#f8f5ef" }}
              >
                {headerSentence}
              </h1>
              {(liveObj.search_query || liveObj.population_definition?.definition) && (
                <div
                  className="mt-4 max-w-3xl space-y-2 border-l-2 pl-4"
                  style={{ borderColor: "rgba(248,245,239,0.15)" }}
                >
                  {liveObj.search_query && (
                    <p className="text-sm leading-relaxed" style={{ color: "rgba(248,245,239,0.7)" }}>
                      <span className="font-mono text-[10px] uppercase tracking-wide text-white/40">
                        Query
                      </span>
                      <span className="mt-0.5 block">{liveObj.search_query}</span>
                    </p>
                  )}
                  {liveObj.population_definition?.definition && (
                    <p className="text-sm leading-[1.7]" style={{ color: "rgba(248,245,239,0.55)" }}>
                      <span className="font-mono text-[10px] uppercase tracking-wide text-white/40">
                        Population
                      </span>
                      <span className="mt-0.5 block">
                        {shortenForField(liveObj.population_definition.definition, 22)}
                      </span>
                    </p>
                  )}
                </div>
              )}
            </div>

            {trustScore != null && trustBreakdown && (
              <ProgramTrustBadge
                score={trustScore}
                breakdown={trustBreakdown}
                variant="header"
                className="max-w-md"
              />
            )}
          </div>
        </header>

        <div className="mt-6 grid grid-cols-1 gap-6 pb-2 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            <AnchorProfilesPanel profiles={liveObj.anchor_profiles} />
            <ExpertDomainsPanel
              expertDomains={liveObj.expert_domains}
              cd1Patterns={liveObj.cd1_patterns}
              cd2Associations={liveObj.cd2_associations}
            />
            <HypothesisFunnelPanel hypotheses={hypotheses} />
            <V3SelectivityHypothesesPanel
              hypotheses={hypotheses}
              selectedId={selectedId}
              onSelect={handlePhase2Select}
            />
            <V3MechanisticChainPanel chain={selected?.mechanistic_chain} />
            <TargetFamilyPanel context={selected?.target_family_context} />
            <V3RankedTargetsPanel
              targets={selected?.ranked_targets}
              falsification={selected?.falsification_experiment}
            />

            {showPhase2 && (
              <section className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1" style={{ background: "rgba(15,26,46,0.1)" }} />
                  <span
                    className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em]"
                    style={{ color: "var(--v3-amber)" }}
                  >
                    Drug development
                  </span>
                  <div className="h-px flex-1" style={{ background: "rgba(15,26,46,0.1)" }} />
                </div>

                {pipelineBlocked && (
                  <div
                    className="rounded-xl border px-5 py-5"
                    style={{
                      borderColor: "rgba(196, 132, 45, 0.35)",
                      background:
                        "linear-gradient(135deg, rgba(15,26,46,0.04) 0%, rgba(196,132,45,0.08) 100%)",
                    }}
                  >
                    <p
                      className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em]"
                      style={{ color: "var(--v3-amber)" }}
                    >
                      Pipeline status
                    </p>
                    <p
                      className="mt-2 font-display text-base font-semibold leading-snug"
                      style={{ color: "var(--v3-navy)" }}
                    >
                      Direct target modulation not pursued
                    </p>
                    <p
                      className="mt-2 text-sm leading-relaxed"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      {blockedReason(drugBranch, undruggable, primaryTarget)} — see
                      undruggable assessment below.
                    </p>
                  </div>
                )}

                {drugBranch && !pipelineBlocked && (
                  <div
                    className="rounded-xl border px-5 py-5"
                    style={{
                      borderColor: "rgba(196, 132, 45, 0.25)",
                      background: "var(--v3-amber-glow)",
                    }}
                  >
                    <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--v3-amber)" }}>
                      Drug branch · {drugBranch.branch}
                    </p>
                    <p className="mt-3 text-sm font-semibold leading-relaxed" style={{ color: "var(--v3-navy)" }}>
                      {drugBranch.drug_exists
                        ? `Existing asset: ${drugBranch.existing_drug_name ?? "identified"}`
                        : "New molecular entity path"}
                    </p>
                    {drugBranch.existing_drug_mechanism && (
                      <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                        {drugBranch.existing_drug_mechanism}
                      </p>
                    )}
                    <div className="mt-4 space-y-3">
                      {drugBranch.selected_modality && (
                        <V3LabeledBlock label="Proposed modality">
                          {drugBranch.selected_modality}
                          {indPackage?.modality_pathway ? ` (${indPackage.modality_pathway})` : ""}
                          {drugBranch.druggability_score != null && (
                            <span className="ml-2 font-mono tabular-nums text-xs">
                              · druggability {(drugBranch.druggability_score * 100).toFixed(0)}%
                            </span>
                          )}
                        </V3LabeledBlock>
                      )}
                      {drugBranch.ip_summary && (
                        <V3LabeledBlock label="IP">
                          <V3StructuredProse content={drugBranch.ip_summary} />
                        </V3LabeledBlock>
                      )}
                      {drugBranch.fto_summary && (
                        <V3LabeledBlock label="FTO">
                          <V3StructuredProse content={drugBranch.fto_summary} />
                        </V3LabeledBlock>
                      )}
                      {drugBranch.redesign_feasibility && (
                        <V3LabeledBlock label="Redesign">
                          <V3StructuredProse content={drugBranch.redesign_feasibility} />
                        </V3LabeledBlock>
                      )}
                      {drugBranch.adc_path_viable != null && (
                        <V3LabeledBlock label="ADC path">
                          {drugBranch.adc_path_viable ? "Viable" : "Not recommended"}
                        </V3LabeledBlock>
                      )}
                    </div>
                  </div>
                )}

                {!pipelineBlocked && (
                  <>
                    <TppBlueprintPanel tpp={tpp} />
                    <RiskOfFailurePanel
                      riskScore={indPackage?.risk_of_failure}
                      components={indPackage?.risk_components}
                    />
                    <IndPackagePanel package_={indPackage?.package} />
                  </>
                )}

                {undruggable.length > 0 && (
                  <div
                    className={cn("rounded-xl border bg-white/70 px-5 py-5")}
                    style={{ borderColor: "rgba(15, 26, 46, 0.1)" }}
                  >
                    <p
                      className="font-display text-base font-semibold"
                      style={{ color: "var(--v3-navy)" }}
                    >
                      Undruggable targets
                    </p>
                    <div className="mt-4">
                      <V3InfoCallout title="Cross-session registry">
                        These targets are saved across discovery programs. Future runs automatically
                        avoid repeating the same undruggable routes. Targets marked rescan-eligible
                        may be reconsidered when you manually re-run target screening on a program —
                        there is no automatic literature watch on this registry yet.
                      </V3InfoCallout>
                    </div>
                    <ul className="mt-4 space-y-3">
                      {undruggable.map((t) => (
                        <li
                          key={t.target_name}
                          className="rounded-lg border px-4 py-3"
                          style={{ borderColor: "rgba(216, 90, 48, 0.2)" }}
                        >
                          <span className="text-sm font-semibold" style={{ color: "var(--v3-navy)" }}>
                            {t.target_name}
                          </span>
                          <div className="mt-2">
                            <V3StructuredProse content={t.reasoning} />
                          </div>
                          {t.alternate_intervention && (
                            <p className="mt-2 text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                              Alternate: {t.alternate_intervention}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-[calc(var(--app-header-height)+0.5rem)] lg:max-h-[calc(100dvh-var(--app-header-height)-1rem)] lg:self-start lg:overflow-y-auto lg:overscroll-y-contain lg:pr-1">
            <div
              className="rounded-xl border px-4 py-4"
              style={{
                borderColor: "rgba(15, 26, 46, 0.1)",
                background: "var(--v3-paper)",
              }}
            >
              <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--v3-teal)" }}>
                Session
              </p>
              <dl className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between gap-4">
                  <dt style={{ color: "var(--color-text-tertiary)" }}>Hypotheses</dt>
                  <dd className="font-mono tabular-nums" style={{ color: "var(--v3-navy)" }}>
                    {hypotheses.filter((h) => !h.is_outgroup).length}
                  </dd>
                </div>
                {selected?.rank != null && (
                  <div className="flex justify-between gap-4">
                    <dt style={{ color: "var(--color-text-tertiary)" }}>Viewing rank</dt>
                    <dd className="font-mono tabular-nums" style={{ color: "var(--v3-teal)" }}>
                      #{selected.rank}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {selected?.falsifiability_statement && (
              <div
                className="rounded-xl border px-4 py-4"
                style={{
                  borderColor: "rgba(196, 132, 45, 0.25)",
                  background: "var(--v3-amber-glow)",
                }}
              >
                <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--v3-amber)" }}>
                  Falsifiability
                </p>
                <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                  {selected.falsifiability_statement}
                </p>
              </div>
            )}

            <V3LiveAgentActivity hypothesisId={selectedId} />
            <V3AuditTrailPanel hypothesisId={selectedId} />
          </aside>
        </div>

        <div
          className="mt-8 border-t pt-6 text-center"
          style={{ borderColor: "rgba(15, 26, 46, 0.08)" }}
        >
          <Link
            href="/dashboard"
            className="text-xs underline-offset-2 hover:underline"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Back to dashboard
          </Link>
        </div>
      </PageContent>
    </>
  );
}
