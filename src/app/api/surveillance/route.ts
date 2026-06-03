import { NextResponse } from "next/server";
import { listOpportunityObjects } from "@/lib/db";
import { runBlackboard } from "@/lib/blackboard";

export async function POST() {
  try {
    const opportunities = await listOpportunityObjects();
    const active = opportunities.filter(
      (o) => o.status === "complete" || o.status === "surveillance"
    );

    let reinitiated = 0;
    for (const obj of active.slice(0, 5)) {
      if (obj.actionability_zone === "act_now" || obj.actionability_zone === "too_early") {
        await runBlackboard(obj.id);
        reinitiated++;
      }
    }

    return NextResponse.json({ scanned: active.length, reinitiated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Surveillance failed" },
      { status: 500 }
    );
  }
}
