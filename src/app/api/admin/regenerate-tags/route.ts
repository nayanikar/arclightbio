import { NextRequest, NextResponse } from "next/server";
import { regenerateAllSurveillanceTags } from "@/lib/regenerateSurveillanceTags";
import { enforceAdminAuth } from "@/lib/adminAuth";
import { clientErrorMessage } from "@/lib/apiError";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const denied = enforceAdminAuth(request);
  if (denied) return denied;

  try {
    const result = await regenerateAllSurveillanceTags();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[admin/regenerate-tags]", err);
    return NextResponse.json(
      { error: clientErrorMessage(err, "Tag regeneration failed") },
      { status: 500 }
    );
  }
}
