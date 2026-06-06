import { NextRequest, NextResponse } from "next/server";
import {
  createOpportunityObjectV2,
  getOrgContext,
  listOrgContexts,
  DEFAULT_ORG_CONTEXTS,
} from "@/lib/db";
import { pickDefaultOrgContext } from "@/lib/orgContext";
import { classifyQuery } from "@/lib/queryClassifier";
import { scheduleBlackboardRunV2, scheduleBlackboardRunV3 } from "@/lib/blackboard";
import { getActionabilityZoneFromConfidence } from "@/lib/scoring";
import type { DomainContext } from "@/types/OpportunityObject";
import type { InnovationLevel, ParentDomain } from "@/types/V3Pipeline";
import { normalizeInnovationLevel } from "@/lib/innovationProfile";
import { isParentDomain } from "@/lib/parentDomains";
import { parseCohortCsv } from "@/lib/cohortParser";
import { isCohortFileWithinLimits } from "@/lib/cohortLimits";
import { createOpportunityObjectV3, saveCohort } from "@/lib/v3Db";

const VALID_DOMAIN_CONTEXTS: DomainContext[] = [
  "general",
  "oncology first-in-class",
  "autoimmune chronic",
  "sex-specific biology",
  "rare disease",
];

async function resolveOrgId(orgContextId?: string): Promise<string> {
  let orgId = orgContextId?.trim() || undefined;
  if (!orgId) {
    const contexts = await listOrgContexts();
    orgId =
      pickDefaultOrgContext(contexts)?.id ?? DEFAULT_ORG_CONTEXTS[0].id;
  }
  return orgId;
}

function parseInnovationLevel(value: unknown): InnovationLevel {
  if (value === "lowest" || value === "medium" || value === "highest") {
    return value;
  }
  return normalizeInnovationLevel(null);
}

async function handleV3Discover(input: {
  query: string;
  parentDomain: string;
  orgContextId?: string;
  cohortCsv: string;
  fileName?: string;
  innovationLevel?: InnovationLevel;
}) {
  if (!input.query?.trim()) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 });
  }
  if (!isParentDomain(input.parentDomain)) {
    return NextResponse.json({ error: "Invalid parent domain" }, { status: 400 });
  }
  if (!input.cohortCsv?.trim()) {
    return NextResponse.json({ error: "Cohort CSV is required" }, { status: 400 });
  }

  const orgId = await resolveOrgId(input.orgContextId);
  const org = await getOrgContext(orgId);
  if (!org) {
    return NextResponse.json({ error: "Org context not found" }, { status: 404 });
  }

  let parseResult;
  try {
    parseResult = parseCohortCsv(input.cohortCsv, {
      fileName: input.fileName ?? "cohort.csv",
      parentDomain: input.parentDomain as ParentDomain,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid cohort CSV" },
      { status: 400 }
    );
  }

  const { cohort } = await saveCohort(parseResult);

  const obj = await createOpportunityObjectV3({
    anchor_type: "human_prompted",
    org_context_id: orgId,
    search_query: input.query.trim(),
    parent_domain: input.parentDomain as ParentDomain,
    cohort_id: cohort.id,
    innovation_level: input.innovationLevel ?? "medium",
  });

  scheduleBlackboardRunV3(obj.id);

  return NextResponse.json({
    id: obj.id,
    schema_version: 3,
    status: "initialising",
    parent_domain: input.parentDomain,
    innovation_level: input.innovationLevel ?? "medium",
    cohort_id: cohort.id,
    cohort_row_count: cohort.row_count,
    cohort_warnings: parseResult.warnings,
    actionability_zone: getActionabilityZoneFromConfidence(
      obj.confidence_score,
      org,
      obj.indication_type
    ),
  });
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const query = String(form.get("query") ?? "").trim();
      const parentDomain = String(form.get("parentDomain") ?? "");
      const orgContextId = String(form.get("orgContextId") ?? "").trim() || undefined;
      const cohortFile = form.get("cohortCsv");
      let cohortCsv = "";
      let fileName = "cohort.csv";

      if (typeof cohortFile === "object" && cohortFile !== null && "text" in cohortFile) {
        const file = cohortFile as File;
        if (!isCohortFileWithinLimits(file.size)) {
          return NextResponse.json(
            { error: "Cohort CSV file is too large (max 5 MB)" },
            { status: 400 }
          );
        }
        cohortCsv = await file.text();
        fileName = file.name || fileName;
      } else if (typeof cohortFile === "string") {
        cohortCsv = cohortFile;
      }

      const innovationLevel = parseInnovationLevel(form.get("innovationLevel"));
      if (parentDomain && cohortCsv) {
        return handleV3Discover({
          query,
          parentDomain,
          orgContextId,
          cohortCsv,
          fileName,
          innovationLevel,
        });
      }
    }

    const body = await request.json();
    const {
      query,
      orgContextId,
      mode = "speed",
      domainContext = "general",
      parentDomain,
      cohortCsv,
      innovationLevel: rawInnovationLevel,
    } = body as {
      query: string;
      orgContextId?: string;
      mode?: "speed" | "depth";
      domainContext?: DomainContext;
      parentDomain?: string;
      cohortCsv?: string;
      innovationLevel?: string;
    };

    if (parentDomain && cohortCsv) {
      return handleV3Discover({
        query,
        parentDomain,
        orgContextId,
        cohortCsv,
        innovationLevel: parseInnovationLevel(rawInnovationLevel),
      });
    }

    if (!query?.trim()) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const resolvedDomain: DomainContext = VALID_DOMAIN_CONTEXTS.includes(
      domainContext
    )
      ? domainContext
      : "general";

    const orgId = await resolveOrgId(orgContextId);
    const org = await getOrgContext(orgId);
    if (!org) {
      return NextResponse.json({ error: "Org context not found" }, { status: 404 });
    }

    const classification = await classifyQuery(query);

    const obj = await createOpportunityObjectV2({
      anchor_type: "human_prompted",
      org_context_id: orgId,
      search_query: query,
      mode,
      evidence_tier: classification.tier,
      query_tier: classification.tier,
      prior_score: classification.prior_score,
      domain_context: resolvedDomain,
    });

    scheduleBlackboardRunV2(obj.id);

    return NextResponse.json({
      id: obj.id,
      schema_version: 2,
      status: "initialising",
      evidence_tier: classification.tier,
      prior_score: classification.prior_score,
      reasoning: classification.reasoning,
      actionability_zone: getActionabilityZoneFromConfidence(
        obj.confidence_score,
        org,
        obj.indication_type
      ),
    });
  } catch (err) {
    console.error("Discover error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Discovery failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const contexts = await listOrgContexts();
  return NextResponse.json({ orgContexts: contexts });
}
