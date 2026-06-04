import { NextResponse } from "next/server";
import { listOpportunityObjects } from "@/lib/db";

export async function POST() {
  try {
    const opportunities = await listOpportunityObjects();
    const active = opportunities.filter(
      (o) => o.status === "complete" || o.status === "surveillance"
    );

    return NextResponse.json({
      scanned: active.length,
      reinitiated: 0,
      note: "Batch blackboard re-runs disabled to prevent duplicate evidence cards",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Surveillance failed" },
      { status: 500 }
    );
  }
}
