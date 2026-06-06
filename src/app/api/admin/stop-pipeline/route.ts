import { NextRequest, NextResponse } from "next/server";
import { pauseAllRunningPipelines } from "@/lib/sessionControl";
import { enforceAdminAuth } from "@/lib/adminAuth";
import { clientErrorMessage } from "@/lib/apiError";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const denied = enforceAdminAuth(request);
  if (denied) return denied;

  try {
    const result = await pauseAllRunningPipelines();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[admin/stop-pipeline]", err);
    return NextResponse.json(
      { error: clientErrorMessage(err, "Failed to stop pipelines") },
      { status: 500 }
    );
  }
}
