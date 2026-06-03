import { NextResponse } from "next/server";
import { pauseAllSurveillance } from "@/lib/sessionControl";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await pauseAllSurveillance();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[admin/stop-surveillance]", err);
    return NextResponse.json(
      { error: "Failed to stop surveillance", detail: String(err) },
      { status: 500 }
    );
  }
}
