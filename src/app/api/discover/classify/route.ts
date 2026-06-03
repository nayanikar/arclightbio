import { NextRequest, NextResponse } from "next/server";
import { classifyQuery } from "@/lib/queryClassifier";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = body as { query?: string };

    if (!query?.trim()) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const classification = await classifyQuery(query);
    return NextResponse.json(classification);
  } catch (err) {
    console.error("[discover/classify]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Classification failed" },
      { status: 500 }
    );
  }
}
