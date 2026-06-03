import { NextResponse } from "next/server";
import { backfillAllOpportunities } from "@/lib/scoreMaintenance";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await backfillAllOpportunities();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[admin/backfill]", err);
    return NextResponse.json(
      { error: "Backfill failed", detail: String(err) },
      { status: 500 }
    );
  }
}
