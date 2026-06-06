import { NextRequest, NextResponse } from "next/server";
import { getOpportunityObject } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let obj = await getOpportunityObject(params.id);
  if (!obj) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const hypothesisId = request.nextUrl.searchParams.get("hypothesisId");
  if (obj.schema_version === 3 && hypothesisId) {
    const { hydrateV3Phase2Artifacts } = await import("@/lib/v3Db");
    obj = await hydrateV3Phase2Artifacts(obj, hypothesisId);
  }

  return NextResponse.json(obj);
}
