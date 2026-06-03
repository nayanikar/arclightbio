import { NextResponse } from "next/server";
import { regenerateAllSurveillanceTags } from "@/lib/regenerateSurveillanceTags";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await regenerateAllSurveillanceTags();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[admin/regenerate-tags]", err);
    return NextResponse.json(
      { error: "Tag regeneration failed", detail: String(err) },
      { status: 500 }
    );
  }
}
