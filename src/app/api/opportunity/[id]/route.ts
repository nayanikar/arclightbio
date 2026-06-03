import { NextResponse } from "next/server";
import { getOpportunityObject } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const obj = await getOpportunityObject(params.id);
  if (!obj) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(obj);
}
