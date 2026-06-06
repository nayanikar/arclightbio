import { NextRequest, NextResponse } from "next/server";
import { getOpportunityObject } from "@/lib/db";
import { updateV3OpportunityFields } from "@/lib/v3Db";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const obj = await getOpportunityObject(params.id);
    if (!obj) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (obj.schema_version !== 3) {
      return NextResponse.json(
        { error: "Hypothesis selection is not supported for this program version" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const hypothesisId = (body as { hypothesisId?: string }).hypothesisId;
    if (!hypothesisId) {
      return NextResponse.json({ error: "hypothesisId is required" }, { status: 400 });
    }

    const valid = (obj.hypotheses ?? []).some(
      (h) => h.id === hypothesisId && h.hypothesis_stage === "selectivity"
    );
    if (!valid) {
      return NextResponse.json({ error: "Invalid selectivity hypothesis" }, { status: 400 });
    }

    await updateV3OpportunityFields(params.id, {
      selected_phase2_hypothesis_id: hypothesisId,
    });

    return NextResponse.json({ id: params.id, selected_phase2_hypothesis_id: hypothesisId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 500 }
    );
  }
}
