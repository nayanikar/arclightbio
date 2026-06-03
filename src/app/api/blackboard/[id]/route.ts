import { NextRequest, NextResponse } from "next/server";
import { runBlackboard } from "@/lib/blackboard";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    runBlackboard(params.id).catch((err) =>
      console.error("Blackboard error:", err)
    );
    return NextResponse.json({ status: "agents_running", id: params.id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Blackboard failed" },
      { status: 500 }
    );
  }
}
