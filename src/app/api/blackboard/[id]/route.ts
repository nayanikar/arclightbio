import { NextRequest, NextResponse } from "next/server";
import { getOpportunityObject } from "@/lib/db";
import { runBlackboard } from "@/lib/blackboard";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json().catch(() => ({}));
    const force = Boolean((body as { force?: boolean }).force);
    const resume = Boolean((body as { resume?: boolean }).resume);

    const obj = await getOpportunityObject(params.id);
    if (!obj) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const result = await runBlackboard(params.id, { force, resume });

    if (!result.ok && result.reason === "lock_busy") {
      return NextResponse.json(
        { error: "Blackboard already running for this opportunity" },
        { status: 409 }
      );
    }

    if (!result.ok && result.reason === "already_complete" && !force) {
      return NextResponse.json(
        { error: "Blackboard already complete; pass force=true to re-run" },
        { status: 409 }
      );
    }

    if (!result.ok && result.reason === "already_running") {
      return NextResponse.json(
        { error: "Blackboard already running" },
        { status: 409 }
      );
    }

    if (!result.ok && result.reason === "agent_failed") {
      return NextResponse.json(
        { status: "agents_failed", id: params.id },
        { status: 500 }
      );
    }

    return NextResponse.json({ status: obj.status, id: params.id, result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Blackboard failed" },
      { status: 500 }
    );
  }
}
