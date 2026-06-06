import { NextRequest, NextResponse } from "next/server";
import { getOpportunityObject } from "@/lib/db";
import { parseCohortCsv } from "@/lib/cohortParser";
import { isCohortFileWithinLimits } from "@/lib/cohortLimits";
import type { ParentDomain } from "@/types/V3Pipeline";
import { isParentDomain } from "@/lib/parentDomains";
import {
  resetBlackboardFromStep,
  saveCohort,
  updateV3OpportunityFields,
} from "@/lib/v3Db";
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
        { error: "Add data is not supported for this program version" },
        { status: 400 }
      );
    }

    const contentType = request.headers.get("content-type") ?? "";
    let cohortCsv = "";
    let fileName = "cohort-append.csv";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("cohortCsv");
      if (typeof file === "object" && file !== null && "text" in file) {
        const cohortFile = file as File;
        if (!isCohortFileWithinLimits(cohortFile.size)) {
          return NextResponse.json(
            { error: "Cohort CSV file is too large (max 5 MB)" },
            { status: 400 }
          );
        }
        cohortCsv = await cohortFile.text();
        fileName = cohortFile.name || fileName;
      }
    } else {
      const body = await request.json();
      cohortCsv = (body as { cohortCsv?: string }).cohortCsv ?? "";
      fileName = (body as { fileName?: string }).fileName ?? fileName;
    }

    if (!cohortCsv.trim()) {
      return NextResponse.json({ error: "cohortCsv is required" }, { status: 400 });
    }

    const parentDomain = obj.parent_domain;
    if (!parentDomain || !isParentDomain(parentDomain)) {
      return NextResponse.json({ error: "Invalid parent domain on opportunity" }, { status: 400 });
    }

    const parseResult = parseCohortCsv(cohortCsv, {
      fileName,
      parentDomain: parentDomain as ParentDomain,
      cohortName: `append-${new Date().toISOString()}`,
    });

    const { cohort } = await saveCohort(parseResult);
    await updateV3OpportunityFields(params.id, { cohort_id: cohort.id });
    await resetBlackboardFromStep(params.id, "phase1:population");
    scheduleBlackboardRunV3(params.id, { resume: true });

    return NextResponse.json({
      id: params.id,
      cohort_id: cohort.id,
      row_count: cohort.row_count,
      warnings: parseResult.warnings,
      status: "agents_running",
      resumed_from: "phase1:population",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Add data failed" },
      { status: 500 }
    );
  }
}
