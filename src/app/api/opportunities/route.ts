import { NextResponse } from "next/server";
import { listOpportunityObjects } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const opportunities = await listOpportunityObjects();
  return NextResponse.json({ opportunities });
}
