import { NextResponse } from "next/server";
import { getOpportunityObject } from "@/lib/db";
import { pauseOpportunity } from "@/lib/sessionControl";

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

    const result = await pauseOpportunity(params.id);

    return NextResponse.json({
      status: "paused",
      alreadyPaused: result.alreadyPaused,
      changeLogEntry: result.changeLogEntry,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Pause failed" },
      { status: 500 }
    );
  }
}
