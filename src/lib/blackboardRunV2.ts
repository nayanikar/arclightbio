import { mechanismAgent } from "@/agents/mechanismAgent";
import { clinicalTrialAgent } from "@/agents/clinicalTrialAgent";
import { commercialAgent } from "@/agents/commercialAgent";
import { rweSignalAgent } from "@/agents/rweSignalAgent";
import { regulatoryAgent } from "@/agents/regulatoryAgent";
import { literatureStage1Agent } from "@/agents/literatureStage1Agent";
import { modalityGateAgent } from "@/agents/modalityAgent";
import {
  getOpportunityObject,
  updateOpportunityObject,
  listHypotheses,
  updateHypothesis,
  getEvidenceCardsForHypothesis,
  getChallengeCountForHypothesis,
  getSharedStage1LiteratureCards,
  clearHypothesesForOpportunity,
} from "@/lib/db";
import {
  acquireBlackboardLock,
  logBlackboardSeriousError,
  isBlackboardComplete as isV1BlackboardComplete,
  checkBlackboardPaused,
} from "@/lib/blackboardRun";
import {
  runWithHypothesisContext,
  withHypothesis,
} from "@/lib/hypothesisContext";
import { emitLiteratureReconciliationCard } from "@/lib/literatureReconciliation";
import {
  runScientificRigorForHypothesis,
  scientificRigorStepKey,
} from "@/agents/scientificRigorAgent";
import {
  decisionSynthesisAgent,
  stage3CrossHypothesisEvaluate,
} from "@/agents/decisionSynthesisAgent";
import { evidenceCardsForHypothesisScoring } from "@/lib/hypothesisCards";
import {
  applyTopHypothesisScores,
  pickTopHypothesis,
  rankHypotheses,
  validateOutgroupCalibration,
  challengesFromCards,
} from "@/lib/hypothesisRanking";
import {
  computeConfidenceScore,
  computeActionabilityScore,
  getActionabilityZoneFromConfidence,
} from "@/lib/scoring";
import { generateSurveillanceTags } from "@/lib/surveillanceTags";
import { broadcastIntentSpaceEvent } from "@/lib/intentSpace/broadcaster";
import { resolveOrgContext } from "@/lib/blackboardRunV2Helpers";
import type { HypothesisRecord, OpportunityObject } from "@/types/OpportunityObject";
import type { RunBlackboardOptions } from "@/lib/blackboardRun";
import {
  activePipelineRun,
  beginPipelineRun,
  endPipelineRun,
  isPipelineAbortedError,
} from "@/lib/pipelineRunControl";

export const BLACKBOARD_V2_STEPS = [
  "stage1:literature",
  "stage2:modality",
  "stage3:evaluate",
  "stage4:rank_and_validate",
  "surveillance",
] as const;

export type BlackboardV2Step = (typeof BLACKBOARD_V2_STEPS)[number];

const STAGE3_AGENTS = [
  "mechanism",
  "clinical_trial",
  "commercial",
  "rwe_signal",
  "regulatory",
] as const;

function stage3StepKey(hypothesisId: string, agent: string): string {
  return `stage3:hypothesis:${hypothesisId}:${agent}`;
}

function isBlackboardV2Complete(state?: { completedSteps?: string[] }): boolean {
  if (!state?.completedSteps?.length) return false;
  return BLACKBOARD_V2_STEPS.every((s) => state.completedSteps!.includes(s));
}

function shouldSkipV2Step(
  step: string,
  completed: Set<string>,
  resume: boolean
): boolean {
  if (step.startsWith("stage3:hypothesis:")) {
    return completed.has(step);
  }
  return resume && completed.has(step);
}

async function refreshHypothesisScores(
  obj: OpportunityObject,
  hypothesis: HypothesisRecord
): Promise<void> {
  const hypothesisCards = await getEvidenceCardsForHypothesis(hypothesis.id);
  const sharedLiterature = await getSharedStage1LiteratureCards(obj.id);
  const cards = [...sharedLiterature, ...hypothesisCards];
  const evidenceCards = evidenceCardsForHypothesisScoring(
    cards,
    hypothesis.is_outgroup
  );
  const challenges = challengesFromCards(cards);
  const org = await resolveOrgContext(obj.org_context_id);
  if (!org) {
    console.warn(
      `[blackboardV2] refreshHypothesisScores skipped — org context missing for ${obj.org_context_id}`
    );
    return;
  }

  const confidence_score = computeConfidenceScore(
    evidenceCards,
    challenges,
    obj.query_tier ?? "clinical"
  );
  const actionability = computeActionabilityScore(evidenceCards, org);
  const actionability_zone = getActionabilityZoneFromConfidence(
    confidence_score,
    org,
    obj.indication_type
  );

  await updateHypothesis(hypothesis.id, {
    confidence_score,
    actionability_score: actionability.score,
    actionability_zone,
  });
}

async function syncTopHypothesisToOpportunity(
  opportunityId: string
): Promise<void> {
  const obj = await getOpportunityObject(opportunityId);
  if (!obj) return;
  const top =
    obj.hypotheses?.find((h) => h.id === obj.top_hypothesis_id) ??
    pickTopHypothesis(obj.hypotheses ?? []);
  if (!top) return;
  await updateOpportunityObject(opportunityId, applyTopHypothesisScores(top));
}

async function patchV2State(
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

async function markV2Step(opportunityId: string, step: string): Promise<void> {
  const obj = await getOpportunityObject(opportunityId);
  const completed = new Set(obj?.blackboard_state?.completedSteps ?? []);
  completed.add(step);
  await patchV2State(opportunityId, {
    completedSteps: Array.from(completed),
  });
}

async function failBlackboardV2Run(
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

export async function runBlackboardV2(
  opportunityId: string,
  options: RunBlackboardOptions = {}
): Promise<{ ok: boolean; reason?: string }> {
  const { resume = false, force = false } = options;
  const lock = await acquireBlackboardLock(opportunityId);
  if (!lock.acquired) return { ok: false, reason: "lock_busy" };

  beginPipelineRun(opportunityId);
  try {
    return await activePipelineRun.run({ opportunityId }, async () => {
    const obj = await getOpportunityObject(opportunityId);
    if (!obj || obj.schema_version !== 2) {
      return { ok: false, reason: "not_v2" };
    }

    if (
      !force &&
      (obj.status === "surveillance" || obj.status === "complete") &&
      isBlackboardV2Complete(obj.blackboard_state)
    ) {
      return { ok: false, reason: "already_complete" };
    }

    if (obj.status === "paused" && !resume) {
      return { ok: false, reason: "paused" };
    }

    if (obj.status === "agents_running" && !resume && !force) {
      return { ok: false, reason: "already_running" };
    }

    if (!resume) {
      broadcastIntentSpaceEvent({
        type: "session_started",
        opportunityId,
        searchQuery: obj.search_query,
        tier: obj.evidence_tier,
      });
    }

    await updateOpportunityObject(opportunityId, { status: "agents_running" });
    let completed = new Set(obj.blackboard_state?.completedSteps ?? []);

    if (force && !resume) {
      await clearHypothesesForOpportunity(opportunityId);
      await updateOpportunityObject(opportunityId, {
        top_hypothesis_id: null,
        outgroup_validation: null,
        blackboard_state: { completedSteps: [] },
      });
      completed = new Set();
    }

    if (!shouldSkipV2Step("stage1:literature", completed, resume)) {
      if (await checkBlackboardPaused(opportunityId)) {
        return { ok: false, reason: "paused" };
      }
      try {
        await literatureStage1Agent(obj);
        await markV2Step(opportunityId, "stage1:literature");
        completed.add("stage1:literature");
      } catch (err) {
        if (isPipelineAbortedError(err)) {
          return { ok: false, reason: "paused" };
        }
        await logBlackboardSeriousError(opportunityId, "stage1:literature", err, 2);
        await failBlackboardV2Run(opportunityId, "stage1:literature", err);
        return { ok: false, reason: "agent_failed" };
      }
    }

    let hypotheses = await listHypotheses(opportunityId);
    if (hypotheses.length === 0) {
      await updateOpportunityObject(opportunityId, { status: "agents_failed" });
      return { ok: false, reason: "no_hypotheses" };
    }

    if (!shouldSkipV2Step("stage2:modality", completed, resume)) {
      if (await checkBlackboardPaused(opportunityId)) {
        return { ok: false, reason: "paused" };
      }
      try {
        for (const h of hypotheses) {
          if (await checkBlackboardPaused(opportunityId)) {
            return { ok: false, reason: "paused" };
          }
          const fresh = (await getOpportunityObject(opportunityId)) ?? obj;
          await modalityGateAgent(fresh, h);
          hypotheses = await listHypotheses(opportunityId);
        }
        await markV2Step(opportunityId, "stage2:modality");
        completed.add("stage2:modality");
      } catch (err) {
        if (isPipelineAbortedError(err)) {
          return { ok: false, reason: "paused" };
        }
        await logBlackboardSeriousError(opportunityId, "stage2:modality", err, 2);
        await failBlackboardV2Run(opportunityId, "stage2:modality", err);
        return { ok: false, reason: "agent_failed" };
      }
    }

    for (const hypothesis of hypotheses) {
      if (await checkBlackboardPaused(opportunityId)) {
        return { ok: false, reason: "paused" };
      }
      const freshObj = (await getOpportunityObject(opportunityId)) ?? obj;
      const h =
        (await listHypotheses(opportunityId)).find((x) => x.id === hypothesis.id) ??
        hypothesis;
      const patched = withHypothesis(freshObj, h);

      for (const agent of STAGE3_AGENTS) {
        const step = stage3StepKey(h.id, agent);
        if (shouldSkipV2Step(step, completed, resume)) continue;

        if (await checkBlackboardPaused(opportunityId)) {
          return { ok: false, reason: "paused" };
        }

        try {
          await runWithHypothesisContext(h, async () => {
            switch (agent) {
              case "mechanism":
                await mechanismAgent(patched);
                break;
              case "clinical_trial":
                await clinicalTrialAgent(patched);
                break;
              case "commercial":
                await commercialAgent(patched);
                break;
              case "rwe_signal":
                await rweSignalAgent(patched);
                break;
              case "regulatory":
                await regulatoryAgent(patched, "full");
                break;
            }
          });
          await refreshHypothesisScores(freshObj, h);
          await markV2Step(opportunityId, step);
          completed.add(step);
        } catch (err) {
          if (isPipelineAbortedError(err)) {
            return { ok: false, reason: "paused" };
          }
          await logBlackboardSeriousError(opportunityId, step, err, 2);
          await failBlackboardV2Run(opportunityId, step, err);
          return { ok: false, reason: "agent_failed" };
        }
      }
    }

    for (const hypothesis of hypotheses) {
      if (await checkBlackboardPaused(opportunityId)) {
        return { ok: false, reason: "paused" };
      }
      const freshObj = (await getOpportunityObject(opportunityId)) ?? obj;
      const h =
        (await listHypotheses(opportunityId)).find((x) => x.id === hypothesis.id) ??
        hypothesis;

      const rigorStep = scientificRigorStepKey(h.id);
      if (!shouldSkipV2Step(rigorStep, completed, resume)) {
        try {
          await runScientificRigorForHypothesis(freshObj, h);
          await markV2Step(opportunityId, rigorStep);
          completed.add(rigorStep);
        } catch (err) {
          await logBlackboardSeriousError(opportunityId, rigorStep, err, 2);
        }
      }
    }

    if (!shouldSkipV2Step("stage3:evaluate", completed, resume)) {
      try {
        await stage3CrossHypothesisEvaluate(opportunityId);
      } catch {
        // Non-fatal
      }
      await markV2Step(opportunityId, "stage3:evaluate");
      completed.add("stage3:evaluate");
    }

    if (!shouldSkipV2Step("stage4:rank_and_validate", completed, resume)) {
      hypotheses = await listHypotheses(opportunityId);
      const ranked = rankHypotheses(hypotheses);
      for (const h of ranked) {
        await updateHypothesis(h.id, { rank: h.rank });
      }

      const challengeMap = new Map<string, number>();
      for (const h of hypotheses) {
        challengeMap.set(h.id, await getChallengeCountForHypothesis(h.id));
      }
      const validation = validateOutgroupCalibration(hypotheses, challengeMap);
      const top = pickTopHypothesis(hypotheses);

      if (top) {
        await updateOpportunityObject(opportunityId, {
          top_hypothesis_id: top.id,
          outgroup_validation: validation,
          ...applyTopHypothesisScores(top),
        });
        try {
          await emitLiteratureReconciliationCard(opportunityId, top);
        } catch {
          // Non-fatal — reconciliation is advisory
        }
      } else {
        await updateOpportunityObject(opportunityId, {
          outgroup_validation: validation,
        });
      }
      await markV2Step(opportunityId, "stage4:rank_and_validate");
      completed.add("stage4:rank_and_validate");

      try {
        await decisionSynthesisAgent(opportunityId);
      } catch {
        // Non-fatal — brief is advisory
      }
    }

    const finalObj = await getOpportunityObject(opportunityId);
    if (finalObj && !shouldSkipV2Step("surveillance", completed, resume)) {
      const top =
        finalObj.hypotheses?.find((h) => h.id === finalObj.top_hypothesis_id) ??
        pickTopHypothesis(finalObj.hypotheses ?? []);
      const tags = await generateSurveillanceTags(
        top
          ? {
              statement: top.statement,
              patient_population: top.patient_population,
              unmet_need: top.unmet_need,
              org_positioning: top.org_positioning,
            }
          : finalObj.hypothesis
      );
      await updateOpportunityObject(opportunityId, {
        status: "surveillance",
        surveillance_tags: tags,
      });
      await markV2Step(opportunityId, "surveillance");
      await syncTopHypothesisToOpportunity(opportunityId);

      const synced = await getOpportunityObject(opportunityId);
      broadcastIntentSpaceEvent({
        type: "blackboard_completed",
        opportunityId,
        confidence: synced?.confidence_score ?? finalObj.confidence_score,
        zone: synced?.actionability_zone ?? finalObj.actionability_zone,
      });
    }

    return { ok: true };
    });
  } catch (err) {
    if (isPipelineAbortedError(err)) {
      return { ok: false, reason: "paused" };
    }
    console.error("Blackboard v2 fatal error:", err);
    await logBlackboardSeriousError(opportunityId, "blackboard_v2_fatal", err, 2);
    await failBlackboardV2Run(opportunityId, "blackboard_v2_fatal", err);
    return { ok: false, reason: "fatal_error" };
  } finally {
    endPipelineRun(opportunityId);
    await lock.release();
  }
}

const LOCK_BUSY_MAX_ATTEMPTS = 6;
const LOCK_BUSY_DELAY_MS = 2000;

async function runScheduledBlackboardV2(
  opportunityId: string,
  options: RunBlackboardOptions
): Promise<void> {
  for (let attempt = 0; attempt < LOCK_BUSY_MAX_ATTEMPTS; attempt++) {
    const result = await runBlackboardV2(opportunityId, options);
    if (result.ok || result.reason !== "lock_busy") {
      return;
    }
    await new Promise((resolve) =>
      setTimeout(resolve, LOCK_BUSY_DELAY_MS * (attempt + 1))
    );
  }

  const obj = await getOpportunityObject(opportunityId);
  if (obj?.status === "agents_running") {
    console.warn(
      `[blackboardV2] lock_busy after ${LOCK_BUSY_MAX_ATTEMPTS} attempts — reverting to paused (${opportunityId})`
    );
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

export function scheduleBlackboardRunV2(
  opportunityId: string,
  options: RunBlackboardOptions = {}
): void {
  const run = () =>
    runScheduledBlackboardV2(opportunityId, options).catch((err) => {
      console.error("Scheduled blackboard v2 run failed:", err);
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

export { isBlackboardV2Complete, isV1BlackboardComplete };

export function isBlackboardV2PausedMidRun(state?: {
  completedSteps?: string[];
  pauseReason?: string;
}): boolean {
  if (!state) return false;
  if (state.pauseReason !== "user_stopped") return false;
  return !isBlackboardV2Complete(state);
}
