import type { ChangeLogEntry, OpportunityObject } from "@/types/OpportunityObject";
import { getOpportunityObject, updateOpportunityObject } from "@/lib/db";
import {
  isBlackboardPausedMidRun,
  isBlackboardComplete,
} from "@/lib/blackboardRun";

const LIVE_STATUSES: OpportunityObject["status"][] = [
  "initialising",
  "agents_running",
  "complete",
  "surveillance",
];

export function isLiveOpportunity(status: OpportunityObject["status"]): boolean {
  return LIVE_STATUSES.includes(status);
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

  if (!isLiveOpportunity(obj.status) && obj.status !== "agents_running") {
    return { paused: false, alreadyPaused: false };
  }

  const pauseReason =
    obj.status === "agents_running" ? ("user_stopped" as const) : ("surveillance" as const);

  const changeLogEntry: ChangeLogEntry = {
    timestamp: new Date().toISOString(),
    trigger: "user_paused",
    agents_reinitiated: [],
    summary:
      obj.status === "agents_running"
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

  if (obj.status !== "paused") {
    return { resumed: false, alreadyActive: true, needsBlackboardResume: false };
  }

  const needsBlackboardResume = isBlackboardPausedMidRun(obj.blackboard_state);

  const changeLogEntry: ChangeLogEntry = {
    timestamp: new Date().toISOString(),
    trigger: "user_resumed",
    agents_reinitiated: needsBlackboardResume ? ["literature"] : [],
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
