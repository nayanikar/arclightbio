import { NextRequest, NextResponse } from "next/server";
import { getOpportunityObject } from "@/lib/db";
import { getTrailForOpportunity } from "@/lib/agentTrail";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const obj = await getOpportunityObject(params.id);
    if (!obj) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const hypothesisId = searchParams.get("hypothesisId") ?? undefined;
    const since = searchParams.get("since") ?? undefined;

    const entries = await getTrailForOpportunity(params.id, {
      hypothesisId,
      since,
    });

    return NextResponse.json({ entries });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Trail fetch failed" },
      { status: 500 }
    );
  }
}
