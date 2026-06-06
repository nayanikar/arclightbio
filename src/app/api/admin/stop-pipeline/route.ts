import { NextResponse } from "next/server";
import { pauseAllRunningPipelines } from "@/lib/sessionControl";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await pauseAllRunningPipelines();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[admin/stop-pipeline]", err);
    return NextResponse.json(
      { error: "Failed to stop pipelines", detail: String(err) },
      { status: 500 }
    );
  }
}
