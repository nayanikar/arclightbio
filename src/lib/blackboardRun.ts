import { appendFile, mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { literatureAgent } from "@/agents/literatureAgent";
import { mechanismAgent } from "@/agents/mechanismAgent";
import { clinicalTrialAgent } from "@/agents/clinicalTrialAgent";
import { commercialAgent } from "@/agents/commercialAgent";
import { regulatoryAgent } from "@/agents/regulatoryAgent";
import { rweSignalAgent } from "@/agents/rweSignalAgent";
import { modalityAgent } from "@/agents/modalityAgent";
import {
  getOpportunityObject,
  updateOpportunityObject,
  getOrgContext,
  getAllEvidenceCards,
  DEFAULT_ORG_CONTEXTS,
} from "@/lib/db";
import {
  computeConfidenceScore,
  computeActionabilityScore,
  getActionabilityZoneFromConfidence,
} from "@/lib/scoring";
import { generateSurveillanceTags } from "@/lib/surveillanceTags";
import { broadcastIntentSpaceEvent } from "@/lib/intentSpace/broadcaster";
import type { IntentSpaceAgent } from "@/lib/intentSpace/types";
import type {
  BlackboardAgentEvent,
  BlackboardState,
  OpportunityObject,
} from "@/types/OpportunityObject";
import type { OrganizationContext } from "@/types/OrganizationContext";

const ERROR_LOG_PATH = path.join(process.cwd(), ".data", "blackboard-errors.log");
const LOCK_DIR = path.join(process.cwd(), ".data", "locks");

export const BLACKBOARD_STEPS = [
  "regulatory:early",
  "literature",
  "mechanism",
  "modality",
  "clinical_trial",
  "commercial",
  "rwe_signal",
  "regulatory:full",
] as const;

export type BlackboardStep = (typeof BLACKBOARD_STEPS)[number];

export interface RunBlackboardOptions {
  resume?: boolean;
  force?: boolean;
}

const inProcessLocks = new Set<string>();

function stepKey(agent: IntentSpaceAgent, phase?: "early" | "full"): BlackboardStep {
  if (agent === "regulatory" && phase) {
    return `regulatory:${phase}` as BlackboardStep;
  }
  return agent as BlackboardStep;
}

function isBlackboardComplete(state?: BlackboardState): boolean {
  if (!state?.completedSteps?.length) return false;
  return BLACKBOARD_STEPS.every((s) => state.completedSteps.includes(s));
}

export async function logBlackboardSeriousError(
  opportunityId: string,
  agent: string,
  error: unknown,
  attempt: number
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const line = JSON.stringify({
    level: "SERIOUS",
    timestamp: new Date().toISOString(),
    opportunityId,
    agent,
    attempt,
    error: message,
  });
  console.error(`[SERIOUS] Blackboard agent failed: ${agent} (${opportunityId}): ${message}`);
  try {
    await mkdir(path.dirname(ERROR_LOG_PATH), { recursive: true });
    await appendFile(ERROR_LOG_PATH, line + "\n", "utf-8");
  } catch (logErr) {
    console.error("[SERIOUS] Failed to write blackboard error log:", logErr);
  }
}

export async function acquireBlackboardLock(
  opportunityId: string
): Promise<{ acquired: boolean; release: () => Promise<void> }> {
  if (inProcessLocks.has(opportunityId)) {
    return { acquired: false, release: async () => {} };
  }

  inProcessLocks.add(opportunityId);
  const lockPath = path.join(LOCK_DIR, `${opportunityId}.lock`);

  try {
    await mkdir(LOCK_DIR, { recursive: true });
    await writeFile(lockPath, String(process.pid), { flag: "wx" });
  } catch {
    inProcessLocks.delete(opportunityId);
    return { acquired: false, release: async () => {} };
  }

  return {
    acquired: true,
    release: async () => {
      inProcessLocks.delete(opportunityId);
      try {
        await unlink(lockPath);
      } catch {
        /* lock file may already be gone */
      }
    },
  };
}

async function resolveOrgContext(orgContextId: string): Promise<OrganizationContext | null> {
  const org = await getOrgContext(orgContextId);
  if (org) return org;

  const fallback =
    DEFAULT_ORG_CONTEXTS.find((o) => o.id === orgContextId) ?? DEFAULT_ORG_CONTEXTS[0];
  await logBlackboardSeriousError(
    orgContextId,
    "refreshScores",
    new Error(`Org context ${orgContextId} not found — using demo fallback ${fallback.org_name}`),
    1
  );
  return fallback;
}

async function patchBlackboardState(
  opportunityId: string,
  patch: Partial<BlackboardState>
): Promise<BlackboardState> {
  const obj = await getOpportunityObject(opportunityId);
  const current: BlackboardState = obj?.blackboard_state ?? { completedSteps: [] };
  const next: BlackboardState = {
    ...current,
    ...patch,
    completedSteps: patch.completedSteps ?? current.completedSteps,
  };
  await updateOpportunityObject(opportunityId, { blackboard_state: next });
  return next;
}

async function recordAgentEvent(
  opportunityId: string,
  event: Omit<BlackboardAgentEvent, "at">
): Promise<void> {
  await patchBlackboardState(opportunityId, {
    lastEvent: { ...event, at: new Date().toISOString() },
  });
}

async function markStepCompleted(
  opportunityId: string,
  step: BlackboardStep
): Promise<void> {
  const obj = await getOpportunityObject(opportunityId);
  const completed = new Set(obj?.blackboard_state?.completedSteps ?? []);
  completed.add(step);
  await patchBlackboardState(opportunityId, {
    completedSteps: Array.from(completed),
  });
}

async function isPaused(opportunityId: string): Promise<boolean> {
  const obj = await getOpportunityObject(opportunityId);
  return obj?.status === "paused";
}

export async function refreshScores(opportunityId: string): Promise<void> {
  const obj = await getOpportunityObject(opportunityId);
  if (!obj) return;

  const allCards = await getAllEvidenceCards(opportunityId);
  const evidenceCards = allCards.filter((c) => !c.is_challenge);
  const challenges = allCards
    .filter((c) => c.is_challenge)
    .map((c) => ({
      id: c.id,
      content: c.content,
      flagged_by: "regulatory" as const,
      evidence_card_ref: c.challenge_metadata?.evidence_card_ref ?? "",
      score_impact: c.challenge_metadata?.score_impact ?? 0,
      dimension: c.challenge_metadata?.dimension ?? ("composite" as const),
    }));

  const org = await resolveOrgContext(obj.org_context_id);
  if (!org) return;

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

  const lastEntry = obj.change_log[obj.change_log.length - 1];
  const shouldLogModifier =
    actionability.modifierSummary != null &&
    lastEntry?.summary !== actionability.modifierSummary;

  await updateOpportunityObject(opportunityId, {
    confidence_score,
    actionability_score: actionability.score,
    actionability_zone,
    ...(shouldLogModifier
      ? {
          change_log: [
            ...obj.change_log,
            {
              timestamp: new Date().toISOString(),
              trigger: "actionability_modifier",
              agents_reinitiated: [],
              summary: actionability.modifierSummary!,
            },
          ],
        }
      : {}),
  });
}

async function failBlackboardRun(
  opportunityId: string,
  agent: string,
  error: unknown
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const obj = await getOpportunityObject(opportunityId);
  if (!obj) return;

  await updateOpportunityObject(opportunityId, {
    status: "agents_failed",
    blackboard_state: {
      ...(obj.blackboard_state ?? { completedSteps: [] }),
      lastError: message,
    },
    change_log: [
      ...obj.change_log,
      {
        timestamp: new Date().toISOString(),
        trigger: "blackboard_failed",
        agents_reinitiated: [],
        summary: `Discovery pipeline stopped: ${agent} agent failed after retry — ${message}`,
      },
    ],
  });
}

async function runTrackedAgent(
  opportunityId: string,
  agent: IntentSpaceAgent,
  runner: () => Promise<void>,
  phase?: "early" | "full"
): Promise<boolean> {
  const startedAt = Date.now();
  const sk = stepKey(agent, phase);

  await recordAgentEvent(opportunityId, {
    type: "agent_started",
    agent,
    phase,
  });

  broadcastIntentSpaceEvent({
    type: "agent_started",
    opportunityId,
    agent,
    ...(phase ? { phase } : {}),
  });

  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await runner();
      await recordAgentEvent(opportunityId, {
        type: "agent_completed",
        agent,
        phase,
      });
      await markStepCompleted(opportunityId, sk);

      broadcastIntentSpaceEvent({
        type: "agent_completed",
        opportunityId,
        agent,
        ...(phase ? { phase } : {}),
        durationMs: Date.now() - startedAt,
      });
      return true;
    } catch (err) {
      lastError = err;
      if (attempt < 2) {
        console.warn(`Agent ${sk} failed (attempt ${attempt}), retrying…`, err);
        continue;
      }
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  await logBlackboardSeriousError(opportunityId, sk, lastError, 2);
  await recordAgentEvent(opportunityId, {
    type: "agent_failed",
    agent,
    phase,
    error: message,
  });
  broadcastIntentSpaceEvent({
    type: "agent_failed",
    opportunityId,
    agent,
    ...(phase ? { phase } : {}),
    error: message,
  });
  await failBlackboardRun(opportunityId, sk, lastError);
  return false;
}

function shouldSkipStep(
  step: BlackboardStep,
  state: BlackboardState | undefined,
  resume: boolean
): boolean {
  if (!resume) return false;
  return state?.completedSteps?.includes(step) ?? false;
}

export async function runBlackboard(
  opportunityId: string,
  options: RunBlackboardOptions = {}
): Promise<{ ok: boolean; reason?: string }> {
  const { resume = false, force = false } = options;
  const lock = await acquireBlackboardLock(opportunityId);

  if (!lock.acquired) {
    return { ok: false, reason: "lock_busy" };
  }

  try {
    const obj = await getOpportunityObject(opportunityId);
    if (!obj) {
      return { ok: false, reason: "not_found" };
    }

    if (obj.status === "paused" && !resume) {
      return { ok: false, reason: "paused" };
    }

    if (
      !force &&
      (obj.status === "surveillance" || obj.status === "complete") &&
      isBlackboardComplete(obj.blackboard_state)
    ) {
      return { ok: false, reason: "already_complete" };
    }

    if (obj.status === "agents_running" && !resume) {
      return { ok: false, reason: "already_running" };
    }

    const checkpoint = obj.blackboard_state ?? { completedSteps: [] };

    if (!resume) {
      broadcastIntentSpaceEvent({
        type: "session_started",
        opportunityId,
        searchQuery: obj.search_query,
        tier: obj.evidence_tier,
      });
    }

    await updateOpportunityObject(opportunityId, { status: "agents_running" });

    if (await isPaused(opportunityId)) {
      return { ok: false, reason: "paused" };
    }

    const runStep = async (
      agent: IntentSpaceAgent,
      phase: "early" | "full" | undefined,
      run: (fresh: OpportunityObject) => Promise<void>
    ): Promise<boolean> => {
      const sk = stepKey(agent, phase);
      if (shouldSkipStep(sk, checkpoint, resume)) {
        return true;
      }
      if (await isPaused(opportunityId)) {
        return false;
      }
      const fresh = (await getOpportunityObject(opportunityId)) ?? obj;
      const ok = await runTrackedAgent(opportunityId, agent, () => run(fresh), phase);
      if (!ok) return false;
      await refreshScores(opportunityId);
      return true;
    };

    if (!(await runStep("regulatory", "early", (fresh) => regulatoryAgent(fresh, "early")))) {
      return { ok: false, reason: "agent_failed" };
    }

    const parallelAgents: IntentSpaceAgent[] = [
      "literature",
      "mechanism",
      "modality",
      "clinical_trial",
      "commercial",
      "rwe_signal",
    ];

    const agentRunners: Partial<
      Record<IntentSpaceAgent, (fresh: OpportunityObject) => Promise<void>>
    > = {
      literature: literatureAgent,
      mechanism: mechanismAgent,
      modality: modalityAgent,
      clinical_trial: clinicalTrialAgent,
      commercial: commercialAgent,
      rwe_signal: rweSignalAgent,
    };

    for (const agent of parallelAgents) {
      const runner = agentRunners[agent];
      if (!runner) continue;
      if (!(await runStep(agent, undefined, runner))) {
        return { ok: false, reason: "agent_failed" };
      }
    }

    if (await isPaused(opportunityId)) {
      return { ok: false, reason: "paused" };
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));

    if (await isPaused(opportunityId)) {
      return { ok: false, reason: "paused" };
    }

    if (!(await runStep("regulatory", "full", (fresh) => regulatoryAgent(fresh, "full")))) {
      return { ok: false, reason: "agent_failed" };
    }

    await refreshScores(opportunityId);

    if (await isPaused(opportunityId)) {
      return { ok: false, reason: "paused" };
    }

    const finalObj = await getOpportunityObject(opportunityId);
    if (finalObj) {
      const tags = await generateSurveillanceTags(finalObj.hypothesis);
      await updateOpportunityObject(opportunityId, {
        status: "surveillance",
        surveillance_tags: tags,
        blackboard_state: {
          ...(finalObj.blackboard_state ?? { completedSteps: [] }),
          pauseReason: undefined,
          lastError: undefined,
        },
      });

      broadcastIntentSpaceEvent({
        type: "blackboard_completed",
        opportunityId,
        confidence: finalObj.confidence_score,
        zone: finalObj.actionability_zone,
      });
    }

    return { ok: true };
  } catch (err) {
    console.error("Blackboard fatal error:", err);
    const obj = await getOpportunityObject(opportunityId);
    if (obj && obj.status === "agents_running") {
      await failBlackboardRun(opportunityId, "blackboard", err);
    }
    return { ok: false, reason: "fatal_error" };
  } finally {
    await lock.release();
  }
}

export function scheduleBlackboardRun(
  opportunityId: string,
  options: RunBlackboardOptions = {}
): void {
  const run = () =>
    runBlackboard(opportunityId, options).catch((err) => {
      console.error("Scheduled blackboard run failed:", err);
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

export function isBlackboardPausedMidRun(state?: BlackboardState): boolean {
  if (!state) return false;
  if (state.pauseReason !== "user_stopped") return false;
  return !isBlackboardComplete(state);
}

export { isBlackboardComplete };
