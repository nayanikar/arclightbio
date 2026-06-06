import { NextRequest, NextResponse } from "next/server";
import { getOpportunityObject, updateOpportunityObject } from "@/lib/db";
import type { ParentDomain } from "@/types/V3Pipeline";
import { isParentDomain } from "@/lib/parentDomains";
import { resetBlackboardFromStep, updateV3OpportunityFields } from "@/lib/v3Db";
import { scheduleBlackboardRunV3 } from "@/lib/blackboard";

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
        { error: "Revise query is not supported for this program version" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { query, parentDomain } = body as {
      query?: string;
      parentDomain?: string;
    };

    if (!query?.trim() && !parentDomain) {
      return NextResponse.json(
        { error: "Provide query and/or parentDomain to revise" },
        { status: 400 }
      );
    }

    if (parentDomain && !isParentDomain(parentDomain)) {
      return NextResponse.json({ error: "Invalid parent domain" }, { status: 400 });
    }

    if (query?.trim()) {
      await updateOpportunityObject(params.id, {
        search_query: query.trim(),
      });
    }

    if (parentDomain) {
      await updateV3OpportunityFields(params.id, {
        parent_domain: parentDomain as ParentDomain,
      });
    }

    await resetBlackboardFromStep(params.id, "phase1:anchors");
    scheduleBlackboardRunV3(params.id, { resume: true });

    return NextResponse.json({
      id: params.id,
      search_query: query?.trim() ?? obj.search_query,
      parent_domain: parentDomain ?? obj.parent_domain,
      status: "agents_running",
      resumed_from: "phase1:anchors",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Revise failed" },
      { status: 500 }
    );
  }
}
