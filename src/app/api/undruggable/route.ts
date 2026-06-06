import { NextResponse } from "next/server";
import { listGlobalUndruggableTargets } from "@/lib/v3Db";
import { computeUndruggableStats } from "@/lib/undruggableRegistry";

export const dynamic = "force-dynamic";

export async function GET() {
  const targets = await listGlobalUndruggableTargets();
  const stats = computeUndruggableStats(targets);
  return NextResponse.json({ targets, stats });
}
