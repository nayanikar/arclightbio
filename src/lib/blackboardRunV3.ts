import type { HypothesisRecord, OpportunityObject } from "@/types/OpportunityObject";
import type { V3Phase } from "@/types/V3Pipeline";
import {
  patientPopulationAgent,
  anchorPopulationAgent,
  marketSizeAgent,
  cd1PatternAgent,
  cd2AssociationAgent,
  expertDomainMergerAgent,
  biologyRecurrenceScorerAgent,
  crossDomainAssociationFilterAgent,
  crossDomainLiteratureAgent,
  crossContextHypothesisMinerAgent,
  associationHypothesisGeneratorAgent,
  causationFilterAgent,
  selectivityFilterAgent,
  selectivityRankerAgent,
  selectivityTargetRankerAgent,
  targetFamilyContextAgent,
  falsificationExperimentDesignerAgent,
  discoveryThesisAgent,
  assessProgramConfidence,
} from "@/agents/phase1";
import {
  existingDrugCheckerAgent,
  ipOwnershipAgent,
  ftoAnalysisAgent,
  drugRedesignFeasibilityAgent,
  adcPathAgent,
  druggabilityAssessmentAgent,
  modalitySelectorAgent,
  tppGeneratorAgent,
  targetRiskScorerAgent,
  ipRiskScorerAgent,
  modalityDevRiskScorerAgent,
  marketPenetrationRiskScorerAgent,
  infrastructureRiskScorerAgent,
  competitionRiskScorerAgent,
  otherRiskScorerAgent,
  riskOfFailureAggregatorAgent,
  modalityPathwayMapperAgent,
  preclinicalRoadmapAgent,
  cmcPlanAgent,
  toxicologyPlanAgent,
  clinicalTrialDesignAgent,
  indPackageAssemblerAgent,
  undruggableTargetRegistryAgent,
  targetSelectionGuardAgent,
} from "@/agents/phase2";
import { targetDruggabilityScreenAgent } from "@/agents/phase2/targetDruggabilityScreenAgent";
import { buildBlockedAssessment, mergeAssessment } from "@/agents/phase2/helpers";
import { getOrgContext } from "@/lib/db";
import { applyTargetScreen } from "@/lib/targetDruggabilityGate";
import { getOpportunityObject, updateOpportunityObject } from "@/lib/db";
import { getActionabilityZoneFromConfidence } from "@/lib/scoring";
import {
  acquireBlackboardLock,
  logBlackboardSeriousError,
  checkBlackboardPaused,
  recordAgentEvent,
} from "@/lib/blackboardRun";
import type { RunBlackboardOptions } from "@/lib/blackboardRun";
import {
  recordV3TrailCompleted,
  recordV3TrailFailed,
  recordV3TrailStarted,
  stepMeta,
} from "@/lib/agentTrail";
import { withTrailCapture } from "@/lib/trailCapture";
import {
  activePipelineRun,
  beginPipelineRun,
  endPipelineRun,
  isPipelineAbortedError,
} from "@/lib/pipelineRunControl";
import {
  listSelectivityHypotheses,
  updateV3OpportunityFields,
  getDrugDiscoveryAssessment,
} from "@/lib/v3Db";

export const BLACKBOARD_V3_PHASE1_STEPS = [
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
  "phase1:complete",
] as const;

export const BLACKBOARD_V3_PHASE2_STEP_PREFIXES = [
  "phase2:target_screen",
  "phase2:drug_check",
  "phase2:ip_fto",
  "phase2:druggability",
  "phase2:modality",
  "phase2:tpp",
  "phase2:risk_scores",
  "phase2:ind_package",
  "phase2:complete",
] as const;

function phase1TargetStepKey(hypothesisId: string): string {
  return `phase1:selectivity_targets:${hypothesisId}`;
}

function phase1FalsificationStepKey(hypothesisId: string): string {
  return `phase1:falsification_exp:${hypothesisId}`;
}

function phase2StepKey(prefix: string, hypothesisId: string): string {
  return `${prefix}:${hypothesisId}`;
}

function phase2CompleteStepKey(hypothesisId: string): string {
  return `phase2:complete:${hypothesisId}`;
}

function isBlackboardV3Complete(state?: { completedSteps?: string[] }): boolean {
  if (!state?.completedSteps?.length) return false;
  const completed = new Set(state.completedSteps);
  if (!completed.has("phase1:complete")) return false;
  return completed.has("phase2:complete");
}

function shouldSkipV3Step(
  step: string,
  completed: Set<string>,
  resume: boolean
): boolean {
  if (resume && completed.has(step)) return true;
  return false;
}

async function patchV3State(
  opportunityId: string,
  patch: Partial<{ completedSteps: string[]; lastError?: string }>
): Promise<void> {
  const obj = await getOpportunityObject(opportunityId);
  const current = obj?.blackboard_state ?? { completedSteps: [] };
  await updateOpportunityObject(opportunityId, {
    blackboard_state: {
      ...current,
      ...patch,
      completedSteps: patch.completedSteps ?? current.completedSteps,
    },
  });
}

async function markV3Step(opportunityId: string, step: string): Promise<void> {
  const obj = await getOpportunityObject(opportunityId);
  const completed = new Set(obj?.blackboard_state?.completedSteps ?? []);
  completed.add(step);
  await patchV3State(opportunityId, {
    completedSteps: Array.from(completed),
  });
}

async function setV3Phase(opportunityId: string, phase: V3Phase | string): Promise<void> {
  await updateV3OpportunityFields(opportunityId, { v3_phase: phase });
}

async function runV3Step(
  opportunityId: string,
  stepKey: string,
  run: () => Promise<unknown>,
  options: { hypothesisId?: string; phase?: V3Phase | string } = {}
): Promise<{ paused?: true; failed?: true }> {
  if (await checkBlackboardPaused(opportunityId)) {
    return { paused: true };
  }

  const meta = stepMeta(stepKey);
  await recordV3TrailStarted(opportunityId, stepKey, options.hypothesisId);
  await recordAgentEvent(opportunityId, {
    type: "agent_started",
    agent: meta.agent,
    phase: meta.phase === "phase2" ? "full" : "early",
  });

  try {
    const { capture } = await withTrailCapture(run);
    await recordV3TrailCompleted(opportunityId, stepKey, {
      hypothesisId: options.hypothesisId,
      summary: capture.summary,
      sources: capture.sources,
    });
    await recordAgentEvent(opportunityId, {
      type: "agent_completed",
      agent: meta.agent,
      phase: meta.phase === "phase2" ? "full" : "early",
    });
    if (options.phase) {
      await setV3Phase(opportunityId, options.phase);
    }
    await markV3Step(opportunityId, stepKey);
    return {};
  } catch (err) {
    if (isPipelineAbortedError(err)) return { paused: true };
    await recordV3TrailFailed(opportunityId, stepKey, err, options.hypothesisId);
    await recordAgentEvent(opportunityId, {
      type: "agent_failed",
      agent: meta.agent,
      phase: meta.phase === "phase2" ? "full" : "early",
      error: err instanceof Error ? err.message : String(err),
    });
    await logBlackboardSeriousError(opportunityId, stepKey, err, 3);
    await failBlackboardV3Run(opportunityId, stepKey, err);
    return { failed: true };
  }
}

async function failBlackboardV3Run(
  opportunityId: string,
  step: string,
  error: unknown
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const obj = await getOpportunityObject(opportunityId);
  if (!obj) return;
  await updateOpportunityObject(opportunityId, {
    status: "agents_failed",
    blackboard_state: {
      ...(obj.blackboard_state ?? { completedSteps: [] }),
      lastError: `${step}: ${message}`,
    },
  });
}

async function runPhase1(obj: OpportunityObject, completed: Set<string>, resume: boolean) {
  const id = obj.id;
  const steps: Array<{
    key: string;
    phase: V3Phase;
    run: () => Promise<unknown>;
  }> = [
    { key: "phase1:population", phase: "phase1:population", run: () => patientPopulationAgent(obj) },
    { key: "phase1:anchors", phase: "phase1:anchors", run: () => anchorPopulationAgent(obj) },
    { key: "phase1:market_size", phase: "phase1:market_size", run: () => marketSizeAgent(obj) },
    { key: "phase1:cd1", phase: "phase1:cd1", run: () => cd1PatternAgent(obj) },
    { key: "phase1:cd2", phase: "phase1:cd2", run: () => cd2AssociationAgent(obj) },
    {
      key: "phase1:expert_domains",
      phase: "phase1:expert_domains",
      run: () => expertDomainMergerAgent(obj),
    },
    {
      key: "phase1:biology_recurrence",
      phase: "phase1:biology_recurrence",
      run: () => biologyRecurrenceScorerAgent(obj),
    },
    {
      key: "phase1:association_filter",
      phase: "phase1:association_filter",
      run: () => crossDomainAssociationFilterAgent(obj),
    },
    {
      key: "phase1:literature_review",
      phase: "phase1:literature_review",
      run: () => crossDomainLiteratureAgent(obj),
    },
    {
      key: "phase1:context_mine",
      phase: "phase1:context_mine",
      run: () => crossContextHypothesisMinerAgent(obj),
    },
    {
      key: "phase1:association_generate",
      phase: "phase1:association_generate",
      run: () => associationHypothesisGeneratorAgent(obj),
    },
    {
      key: "phase1:causation_filter",
      phase: "phase1:causation_filter",
      run: () => causationFilterAgent(obj),
    },
    {
      key: "phase1:selectivity_filter",
      phase: "phase1:selectivity_filter",
      run: () => selectivityFilterAgent(obj),
    },
    {
      key: "phase1:selectivity_rank",
      phase: "phase1:selectivity_rank",
      run: () => selectivityRankerAgent(obj),
    },
  ];

  for (const step of steps) {
    if (shouldSkipV3Step(step.key, completed, resume)) continue;
    const result = await runV3Step(id, step.key, () => step.run(), {
      phase: step.phase,
    });
    if (result.paused) return { paused: true as const };
    if (result.failed) return { failed: true as const };
    completed.add(step.key);
  }

  const targetRankStep = "phase1:selectivity_targets";
  if (!shouldSkipV3Step(targetRankStep, completed, resume)) {
    const fresh = (await getOpportunityObject(id)) ?? obj;
    const result = await runV3Step(
      id,
      targetRankStep,
      () => selectivityTargetRankerAgent(fresh),
      { phase: "phase1:selectivity_targets" }
    );
    if (result.paused) return { paused: true as const };
    if (result.failed) return { failed: true as const };
    completed.add(targetRankStep);
  }

  const selectivity = await listSelectivityHypotheses(id);
  for (const h of selectivity) {
    const targetStep = phase1TargetStepKey(h.id);
    if (shouldSkipV3Step(targetStep, completed, resume)) continue;
    const ctx = (await getOpportunityObject(id)) ?? obj;
    const result = await runV3Step(
      id,
      targetStep,
      () => targetFamilyContextAgent(ctx, h.id),
      { hypothesisId: h.id, phase: "phase1:selectivity_targets" }
    );
    if (result.paused) return { paused: true as const };
    if (result.failed) return { failed: true as const };
    completed.add(targetStep);
  }

  for (const h of selectivity) {
    const falsStep = phase1FalsificationStepKey(h.id);
    if (shouldSkipV3Step(falsStep, completed, resume)) continue;
    const ctx = (await getOpportunityObject(id)) ?? obj;
    const result = await runV3Step(
      id,
      falsStep,
      () => falsificationExperimentDesignerAgent(ctx, h.id),
      { hypothesisId: h.id, phase: "phase1:falsification_exp" }
    );
    if (result.paused) return { paused: true as const };
    if (result.failed) return { failed: true as const };
    completed.add(falsStep);
  }

  if (!shouldSkipV3Step("phase1:complete", completed, resume)) {
    const top = selectivity.find((h) => h.rank === 1) ?? selectivity[0];
    const fresh = (await getOpportunityObject(id)) ?? obj;
    const trust = await assessProgramConfidence({
      obj: fresh,
      phase: "phase1_complete",
    });
    const actionability_zone = getActionabilityZoneFromConfidence(trust.overall);

    await updateOpportunityObject(id, {
      top_hypothesis_id: top?.id ?? null,
      confidence_score: trust.overall,
      actionability_zone,
    });
    await updateV3OpportunityFields(id, {
      selected_phase2_hypothesis_id: top?.id ?? null,
      program_trust_score: trust.overall,
      program_trust_breakdown: trust,
    });
    await markV3Step(id, "phase1:complete");
    await setV3Phase(id, "phase1:complete");
    completed.add("phase1:complete");
  }

  return { ok: true as const };
}

async function promoteDruggablePhase2Hypothesis(opportunityId: string): Promise<void> {
  const selectivity = await listSelectivityHypotheses(opportunityId);
  if (selectivity.length === 0) return;

  const obj = await getOpportunityObject(opportunityId);
  const currentId =
    obj?.selected_phase2_hypothesis_id ??
    obj?.top_hypothesis_id ??
    selectivity[0]?.id;

  async function hypothesisDruggable(hypothesisId: string): Promise<boolean> {
    const assessment = await getDrugDiscoveryAssessment(opportunityId, hypothesisId);
    if (assessment?.assessment.pipeline_status === "blocked_undruggable") {
      return false;
    }
    const hyp = selectivity.find((h) => h.id === hypothesisId);
    return (hyp?.ranked_targets?.length ?? 0) > 0;
  }

  if (currentId && (await hypothesisDruggable(currentId))) return;

  const sorted = [...selectivity].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  for (const h of sorted) {
    if (await hypothesisDruggable(h.id)) {
      await updateOpportunityObject(opportunityId, { top_hypothesis_id: h.id });
      await updateV3OpportunityFields(opportunityId, {
        selected_phase2_hypothesis_id: h.id,
      });
      return;
    }
  }
}

async function runPhase2IpFto(
  obj: OpportunityObject,
  hypothesis: HypothesisRecord
): Promise<void> {
  const assessment = await getDrugDiscoveryAssessment(obj.id, hypothesis.id);
  if (assessment?.branch === "existing") {
    await ipOwnershipAgent(obj, hypothesis);
    await ftoAnalysisAgent(obj, hypothesis);
    await drugRedesignFeasibilityAgent(obj, hypothesis);
    await adcPathAgent(obj, hypothesis);
  } else {
    await ipOwnershipAgent(obj, hypothesis);
    await ftoAnalysisAgent(obj, hypothesis);
  }
}

async function runPhase2TargetScreen(
  obj: OpportunityObject,
  hypothesis: HypothesisRecord
): Promise<{ blocked: boolean; hypothesis: HypothesisRecord }> {
  const screenResults = await targetDruggabilityScreenAgent(obj, hypothesis);
  const { updatedHypothesis, blocked } = await applyTargetScreen(
    obj.id,
    hypothesis,
    screenResults
  );

  const primary =
    updatedHypothesis.ranked_targets?.[0]?.target_name ??
    updatedHypothesis.ranked_targets?.[0]?.gene_symbol ??
    null;

  if (blocked) {
    await mergeAssessment(
      obj.id,
      hypothesis.id,
      buildBlockedAssessment(
        "All ranked targets failed three-modality druggability screen — direct target modulation not pursued.",
        primary
      )
    );
  } else {
    await mergeAssessment(obj.id, hypothesis.id, {
      pipeline_status: "active",
      screened_primary_target: primary ?? undefined,
      blocked_reason: undefined,
    });
  }

  return { blocked, hypothesis: updatedHypothesis };
}

async function runPhase2(
  obj: OpportunityObject,
  hypothesis: HypothesisRecord,
  completed: Set<string>,
  resume: boolean
) {
  const id = obj.id;
  const hid = hypothesis.id;
  let activeHypothesis = hypothesis;

  const screenKey = phase2StepKey("phase2:target_screen", hid);
  if (!shouldSkipV3Step(screenKey, completed, resume)) {
    let screenOutcome: { blocked: boolean; hypothesis: HypothesisRecord } | null =
      null;
    const screenResult = await runV3Step(
      id,
      screenKey,
      async () => {
        screenOutcome = await runPhase2TargetScreen(obj, activeHypothesis);
      },
      { hypothesisId: hid, phase: "phase2:target_screen" }
    );
    if (screenResult.paused) return { paused: true as const };
    if (screenResult.failed) return { failed: true as const };
    completed.add(screenKey);

    const outcome = screenOutcome as {
      blocked: boolean;
      hypothesis: HypothesisRecord;
    } | null;
    if (outcome?.hypothesis) {
      activeHypothesis = outcome.hypothesis;
    }
    if (outcome?.blocked) {
      const completeKey = phase2CompleteStepKey(hid);
      if (!shouldSkipV3Step(completeKey, completed, resume)) {
        await markV3Step(id, completeKey);
        completed.add(completeKey);
      }
      return { ok: true as const, blocked: true as const };
    }
  } else {
    const existing = await getDrugDiscoveryAssessment(id, hid);
    if (existing?.assessment.pipeline_status === "blocked_undruggable") {
      const completeKey = phase2CompleteStepKey(hid);
      if (!shouldSkipV3Step(completeKey, completed, resume)) {
        await markV3Step(id, completeKey);
        completed.add(completeKey);
      }
      return { ok: true as const, blocked: true as const };
    }
  }

  const phase2Steps: Array<{
    prefix: (typeof BLACKBOARD_V3_PHASE2_STEP_PREFIXES)[number];
    run: () => Promise<void>;
  }> = [
    {
      prefix: "phase2:drug_check",
      run: () => existingDrugCheckerAgent(obj, activeHypothesis),
    },
    {
      prefix: "phase2:ip_fto",
      run: () => runPhase2IpFto(obj, activeHypothesis),
    },
    {
      prefix: "phase2:druggability",
      run: async () => {
        const a = await getDrugDiscoveryAssessment(id, hid);
        if (a?.branch !== "existing") {
          await druggabilityAssessmentAgent(obj, activeHypothesis);
        }
      },
    },
    {
      prefix: "phase2:modality",
      run: async () => {
        const a = await getDrugDiscoveryAssessment(id, hid);
        if (a?.branch !== "existing") {
          await modalitySelectorAgent(obj, activeHypothesis);
        } else if (a?.assessment?.adc_path_viable) {
          await modalitySelectorAgent(obj, activeHypothesis);
        }
      },
    },
    { prefix: "phase2:tpp", run: () => tppGeneratorAgent(obj, activeHypothesis) },
    {
      prefix: "phase2:risk_scores",
      run: async () => {
        await targetRiskScorerAgent(obj, activeHypothesis);
        await ipRiskScorerAgent(obj, activeHypothesis);
        await modalityDevRiskScorerAgent(obj, activeHypothesis);
        await marketPenetrationRiskScorerAgent(obj, activeHypothesis);
        await infrastructureRiskScorerAgent(obj, activeHypothesis);
        await competitionRiskScorerAgent(obj, activeHypothesis);
        await otherRiskScorerAgent(obj, activeHypothesis);
        await riskOfFailureAggregatorAgent(obj, activeHypothesis);
        await modalityPathwayMapperAgent(obj, activeHypothesis);
        await preclinicalRoadmapAgent(obj, activeHypothesis);
        await cmcPlanAgent(obj, activeHypothesis);
        await toxicologyPlanAgent(obj, activeHypothesis);
        await clinicalTrialDesignAgent(obj, activeHypothesis);
      },
    },
    {
      prefix: "phase2:ind_package",
      run: async () => {
        await indPackageAssemblerAgent(obj, activeHypothesis);
        await undruggableTargetRegistryAgent(obj, activeHypothesis);
        const guard = await targetSelectionGuardAgent(obj, activeHypothesis);
        if (guard.blocked) {
          const screenedPrimary =
            activeHypothesis.ranked_targets?.[0]?.target_name ??
            activeHypothesis.ranked_targets?.[0]?.gene_symbol ??
            null;
          await mergeAssessment(
            id,
            hid,
            buildBlockedAssessment(
              guard.warnings.join(" ") ||
                "Primary target blocked by undruggable guard.",
              screenedPrimary
            )
          );
        }
      },
    },
  ];

  for (const step of phase2Steps) {
    const key = phase2StepKey(step.prefix, hid);
    if (shouldSkipV3Step(key, completed, resume)) continue;
    const result = await runV3Step(id, key, () => step.run(), {
      hypothesisId: hid,
      phase: step.prefix,
    });
    if (result.paused) return { paused: true as const };
    if (result.failed) return { failed: true as const };
    completed.add(key);
  }

  const completeKey = phase2CompleteStepKey(hid);
  if (!shouldSkipV3Step(completeKey, completed, resume)) {
    await markV3Step(id, completeKey);
    completed.add(completeKey);
  }

  return { ok: true as const };
}

export async function runBlackboardV3(
  opportunityId: string,
  options: RunBlackboardOptions = {}
): Promise<{ ok: boolean; reason?: string }> {
  const { resume = false, force = false } = options;
  const lock = await acquireBlackboardLock(opportunityId);
  if (!lock.acquired) return { ok: false, reason: "lock_busy" };

  beginPipelineRun(opportunityId);
  try {
    return await activePipelineRun.run({ opportunityId }, async () => {
      let obj = await getOpportunityObject(opportunityId);
      if (!obj || obj.schema_version !== 3) {
        return { ok: false, reason: "not_v3" };
      }

      if (
        !force &&
        (obj.status === "complete" || obj.status === "surveillance") &&
        isBlackboardV3Complete(obj.blackboard_state)
      ) {
        return { ok: false, reason: "already_complete" };
      }

      if (obj.status === "paused" && !resume) {
        return { ok: false, reason: "paused" };
      }

      if (obj.status === "agents_running" && !resume && !force) {
        return { ok: false, reason: "already_running" };
      }

      await updateOpportunityObject(opportunityId, { status: "agents_running" });
      const completed = new Set(obj.blackboard_state?.completedSteps ?? []);

      if (force && !resume) {
        await updateOpportunityObject(opportunityId, {
          blackboard_state: { completedSteps: [] },
          top_hypothesis_id: null,
          selected_phase2_hypothesis_id: null,
        });
        completed.clear();
      }

      const phase1Result = await runPhase1(obj, completed, resume);
      if ("paused" in phase1Result && phase1Result.paused) {
        return { ok: false, reason: "paused" };
      }
      if ("failed" in phase1Result && phase1Result.failed) {
        return { ok: false, reason: "agent_failed" };
      }

      obj = (await getOpportunityObject(opportunityId)) ?? obj;
      const selectivityHypotheses = await listSelectivityHypotheses(opportunityId);
      if (selectivityHypotheses.length === 0) {
        const fresh = (await getOpportunityObject(opportunityId)) ?? obj;
        const trust = await assessProgramConfidence({
          obj: fresh,
          phase: "phase1_complete",
        });
        await updateOpportunityObject(opportunityId, {
          status: "complete",
          confidence_score: trust.overall,
          actionability_zone: "too_early",
          blackboard_state: {
            ...(fresh.blackboard_state ?? { completedSteps: [] }),
            lastError: undefined,
            outcome: "phase1_complete_no_selectivity",
          },
        });
        await updateV3OpportunityFields(opportunityId, {
          program_trust_score: trust.overall,
          program_trust_breakdown: trust,
        });
        return { ok: true, reason: "phase1_only_no_selectivity" };
      }

      for (const phase2Hypothesis of selectivityHypotheses) {
        obj = (await getOpportunityObject(opportunityId)) ?? obj;
        const phase2Result = await runPhase2(obj, phase2Hypothesis, completed, resume);
        if ("paused" in phase2Result && phase2Result.paused) {
          return { ok: false, reason: "paused" };
        }
        if ("failed" in phase2Result && phase2Result.failed) {
          return { ok: false, reason: "agent_failed" };
        }
      }

      await promoteDruggablePhase2Hypothesis(opportunityId);

      if (!shouldSkipV3Step("phase2:complete", completed, resume)) {
        await markV3Step(opportunityId, "phase2:complete");
        await setV3Phase(opportunityId, "phase2:complete");
        completed.add("phase2:complete");

        const fresh = (await getOpportunityObject(opportunityId)) ?? obj;
        await discoveryThesisAgent(fresh);
        const trust = await assessProgramConfidence({
          obj: fresh,
          phase: "phase2_complete",
        });
        const org = await getOrgContext(fresh.org_context_id);
        const actionability_zone = getActionabilityZoneFromConfidence(
          trust.overall,
          org
        );
        await updateOpportunityObject(opportunityId, {
          confidence_score: trust.overall,
          actionability_zone,
        });
        await updateV3OpportunityFields(opportunityId, {
          program_trust_score: trust.overall,
          program_trust_breakdown: trust,
        });
      }

      await updateOpportunityObject(opportunityId, { status: "complete" });
      return { ok: true };
    });
  } catch (err) {
    if (isPipelineAbortedError(err)) {
      return { ok: false, reason: "paused" };
    }
    console.error("Blackboard v3 fatal error:", err);
    await logBlackboardSeriousError(opportunityId, "blackboard_v3_fatal", err, 3);
    await failBlackboardV3Run(opportunityId, "blackboard_v3_fatal", err);
    return { ok: false, reason: "fatal_error" };
  } finally {
    endPipelineRun(opportunityId);
    await lock.release();
  }
}

const LOCK_BUSY_MAX_ATTEMPTS = 6;
const LOCK_BUSY_DELAY_MS = 2000;

async function runScheduledBlackboardV3(
  opportunityId: string,
  options: RunBlackboardOptions
): Promise<void> {
  for (let attempt = 0; attempt < LOCK_BUSY_MAX_ATTEMPTS; attempt++) {
    const result = await runBlackboardV3(opportunityId, options);
    if (result.ok || result.reason !== "lock_busy") return;
    await new Promise((resolve) =>
      setTimeout(resolve, LOCK_BUSY_DELAY_MS * (attempt + 1))
    );
  }

  const obj = await getOpportunityObject(opportunityId);
  if (obj?.status === "agents_running") {
    await updateOpportunityObject(opportunityId, {
      status: "paused",
      blackboard_state: {
        ...(obj.blackboard_state ?? { completedSteps: [] }),
        pauseReason: "user_stopped",
        lastError: "Pipeline lock busy — click Resume to retry",
      },
    });
  }
}

export function scheduleBlackboardRunV3(
  opportunityId: string,
  options: RunBlackboardOptions = {}
): void {
  const run = () =>
    runScheduledBlackboardV3(opportunityId, options).catch((err) => {
      console.error("Scheduled blackboard v3 run failed:", err);
    });

  if (process.env.VERCEL) {
    import("@vercel/functions")
      .then(({ waitUntil }) => waitUntil(run()))
      .catch(() => {
        void run();
      });
  } else {
    void run();
  }
}

export function isBlackboardV3PausedMidRun(state?: {
  completedSteps?: string[];
  pauseReason?: string;
}): boolean {
  if (!state) return false;
  if (state.pauseReason !== "user_stopped") return false;
  return !isBlackboardV3Complete(state);
}

export { isBlackboardV3Complete };
