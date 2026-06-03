import { NextResponse } from "next/server";
import { getOpportunityObject } from "@/lib/db";
import { resumeOpportunity } from "@/lib/sessionControl";

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

    return NextResponse.json({
      status: "surveillance",
      resumed: result.resumed,
      alreadyActive: result.alreadyActive,
      changeLogEntry: result.changeLogEntry,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Resume failed" },
      { status: 500 }
    );
  }
}
