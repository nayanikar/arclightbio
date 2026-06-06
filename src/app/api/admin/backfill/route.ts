import { NextRequest, NextResponse } from "next/server";
import { backfillAllOpportunities } from "@/lib/scoreMaintenance";
import { enforceAdminAuth } from "@/lib/adminAuth";
import { clientErrorMessage } from "@/lib/apiError";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const denied = enforceAdminAuth(request);
  if (denied) return denied;

  try {
    const result = await backfillAllOpportunities();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[admin/backfill]", err);
    return NextResponse.json(
      { error: clientErrorMessage(err, "Backfill failed") },
      { status: 500 }
    );
  }
}
