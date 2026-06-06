import { NextResponse } from "next/server";
import { getOpportunityObject } from "@/lib/db";
import { resumeOpportunity } from "@/lib/sessionControl";
import {
  scheduleBlackboardRun,
  scheduleBlackboardRunV2,
  scheduleBlackboardRunV3,
} from "@/lib/blackboard";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const obj = await getOpportunityObject(params.id);
    if (!obj) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const result = await resumeOpportunity(params.id);

    if (result.needsBlackboardResume) {
      if (obj.schema_version === 3) {
        scheduleBlackboardRunV3(params.id, { resume: true });
      } else if (obj.schema_version === 2) {
        scheduleBlackboardRunV2(params.id, { resume: true });
      } else {
        scheduleBlackboardRun(params.id, { resume: true });
      }
    }

    return NextResponse.json({
      status: result.needsBlackboardResume ? "agents_running" : "surveillance",
      resumed: result.resumed,
      alreadyActive: result.alreadyActive,
      needsBlackboardResume: result.needsBlackboardResume,
      changeLogEntry: result.changeLogEntry,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Resume failed" },
      { status: 500 }
    );
  }
}
