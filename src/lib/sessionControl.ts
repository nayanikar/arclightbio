import type { ChangeLogEntry, OpportunityObject } from "@/types/OpportunityObject";
import { getOpportunityObject, updateOpportunityObject } from "@/lib/db";
import { isBlackboardComplete } from "@/lib/blackboardRun";
import { isBlackboardV2Complete } from "@/lib/blackboardRunV2";
import { isBlackboardV3Complete } from "@/lib/blackboardRunV3";
import { abortPipelineRun } from "@/lib/pipelineRunControl";

const LIVE_STATUSES: OpportunityObject["status"][] = [
  "initialising",
  "agents_running",
  "complete",
  "surveillance",
];

export function isLiveOpportunity(status: OpportunityObject["status"]): boolean {
  return LIVE_STATUSES.includes(status);
}

function isBlackboardIncomplete(obj: OpportunityObject): boolean {
  const state = obj.blackboard_state;
  const version = obj.schema_version ?? 1;
  if (version === 3) return !isBlackboardV3Complete(state);
  if (version === 2) return !isBlackboardV2Complete(state);
  return !isBlackboardComplete(state);
}

export async function pauseOpportunity(
  id: string,
  summary = "Surveillance paused — preserving API credits"
): Promise<{
  paused: boolean;
  alreadyPaused: boolean;
  changeLogEntry?: ChangeLogEntry;
}> {
  const obj = await getOpportunityObject(id);
  if (!obj) {
    throw new Error("Opportunity not found");
  }

  if (obj.status === "paused") {
    return { paused: false, alreadyPaused: true };
  }

  const isRunningPipeline =
    obj.status === "agents_running" ||
    (obj.status === "initialising" && isBlackboardIncomplete(obj));

  if (!isRunningPipeline && !isLiveOpportunity(obj.status)) {
    return { paused: false, alreadyPaused: false };
  }

  if (isRunningPipeline) {
    abortPipelineRun(id);
  }

  const pauseReason = isBlackboardIncomplete(obj)
    ? ("user_stopped" as const)
    : ("surveillance" as const);

  const changeLogEntry: ChangeLogEntry = {
    timestamp: new Date().toISOString(),
    trigger: "user_paused",
    agents_reinitiated: [],
    summary:
      obj.status === "agents_running" || obj.status === "initialising"
        ? "Agent pipeline paused — progress saved"
        : summary,
  };

  await updateOpportunityObject(id, {
    status: "paused",
    blackboard_state: {
      completedSteps: obj.blackboard_state?.completedSteps ?? [],
      pauseReason,
      lastEvent: obj.blackboard_state?.lastEvent,
      lastError: obj.blackboard_state?.lastError,
    },
    change_log: [...obj.change_log, changeLogEntry],
  });

  return { paused: true, alreadyPaused: false, changeLogEntry };
}

export async function resumeOpportunity(id: string): Promise<{
  resumed: boolean;
  alreadyActive: boolean;
  needsBlackboardResume: boolean;
  changeLogEntry?: ChangeLogEntry;
}> {
  const obj = await getOpportunityObject(id);
  if (!obj) {
    throw new Error("Opportunity not found");
  }

  const pipelineIncomplete = isBlackboardIncomplete(obj);

  if (obj.status !== "paused") {
    if (pipelineIncomplete && obj.status === "surveillance") {
      const changeLogEntry: ChangeLogEntry = {
        timestamp: new Date().toISOString(),
        trigger: "user_resumed",
        agents_reinitiated: ["literature"],
        summary: "Agent pipeline resumed — continuing discovery",
      };

      await updateOpportunityObject(id, {
        status: "agents_running",
        blackboard_state: {
          ...(obj.blackboard_state ?? { completedSteps: [] }),
          pauseReason: undefined,
        },
        change_log: [...obj.change_log, changeLogEntry],
      });

      return {
        resumed: true,
        alreadyActive: false,
        needsBlackboardResume: true,
        changeLogEntry,
      };
    }

    return { resumed: false, alreadyActive: true, needsBlackboardResume: false };
  }

  const needsBlackboardResume = pipelineIncomplete;

  const changeLogEntry: ChangeLogEntry = {
    timestamp: new Date().toISOString(),
    trigger: "user_resumed",
    agents_reinitiated:
      needsBlackboardResume && (obj.schema_version ?? 1) !== 2
        ? ["literature"]
        : [],
    summary: needsBlackboardResume
      ? "Agent pipeline resumed — continuing discovery"
      : "Surveillance resumed",
  };

  await updateOpportunityObject(id, {
    status: needsBlackboardResume ? "agents_running" : "surveillance",
    blackboard_state: {
      ...(obj.blackboard_state ?? { completedSteps: [] }),
      pauseReason: undefined,
    },
    change_log: [...obj.change_log, changeLogEntry],
  });

  return {
    resumed: true,
    alreadyActive: false,
    needsBlackboardResume,
    changeLogEntry,
  };
}

export async function pauseAllRunningPipelines(): Promise<{
  paused: number;
  skipped: number;
  aborted: number;
  sessions: { id: string; search_query: string | null }[];
}> {
  const { listOpportunityObjects } = await import("@/lib/db");
  const { abortAllPipelineRuns } = await import("@/lib/pipelineRunControl");
  const opportunities = await listOpportunityObjects();
  const aborted = abortAllPipelineRuns().length;
  let paused = 0;
  let skipped = 0;
  const sessions: { id: string; search_query: string | null }[] = [];

  for (const opp of opportunities) {
    const running =
      opp.status === "agents_running" ||
      (opp.status === "initialising" && isBlackboardIncomplete(opp));

    if (!running) {
      skipped += 1;
      continue;
    }

    const result = await pauseOpportunity(
      opp.id,
      "Discovery pipeline stopped — preserving API credits"
    );
    if (result.paused) {
      paused += 1;
      sessions.push({ id: opp.id, search_query: opp.search_query ?? null });
    } else {
      skipped += 1;
    }
  }

  return { paused, skipped, aborted, sessions };
}

export async function pauseAllSurveillance(): Promise<{
  paused: number;
  skipped: number;
}> {
  const { listOpportunityObjects } = await import("@/lib/db");
  const opportunities = await listOpportunityObjects();
  let paused = 0;
  let skipped = 0;

  for (const opp of opportunities) {
    if (opp.status !== "surveillance" && opp.status !== "complete") {
      skipped += 1;
      continue;
    }
    const result = await pauseOpportunity(
      opp.id,
      "Surveillance stopped globally — preserving API credits"
    );
    if (result.paused) paused += 1;
    else skipped += 1;
  }

  return { paused, skipped };
}

export { isBlackboardComplete };
