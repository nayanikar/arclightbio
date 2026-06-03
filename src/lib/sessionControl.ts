import type { ChangeLogEntry, OpportunityObject } from "@/types/OpportunityObject";
import { getOpportunityObject, updateOpportunityObject } from "@/lib/db";

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

  if (!isLiveOpportunity(obj.status)) {
    return { paused: false, alreadyPaused: false };
  }

  const changeLogEntry: ChangeLogEntry = {
    timestamp: new Date().toISOString(),
    trigger: "user_paused",
    agents_reinitiated: [],
    summary,
  };

  await updateOpportunityObject(id, {
    status: "paused",
    change_log: [...obj.change_log, changeLogEntry],
  });

  return { paused: true, alreadyPaused: false, changeLogEntry };
}

export async function resumeOpportunity(
  id: string
): Promise<{
  resumed: boolean;
  alreadyActive: boolean;
  changeLogEntry?: ChangeLogEntry;
}> {
  const obj = await getOpportunityObject(id);
  if (!obj) {
    throw new Error("Opportunity not found");
  }

  if (obj.status !== "paused") {
    return { resumed: false, alreadyActive: true };
  }

  const changeLogEntry: ChangeLogEntry = {
    timestamp: new Date().toISOString(),
    trigger: "user_resumed",
    agents_reinitiated: [],
    summary: "Surveillance resumed",
  };

  await updateOpportunityObject(id, {
    status: "surveillance",
    change_log: [...obj.change_log, changeLogEntry],
  });

  return { resumed: true, alreadyActive: false, changeLogEntry };
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