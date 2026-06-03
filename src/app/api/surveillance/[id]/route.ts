import { NextResponse } from "next/server";
import { runSurveillanceScan } from "@/lib/surveillance";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const result = await runSurveillanceScan(params.id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Surveillance scan failed" },
      { status: 500 }
    );
  }
}
