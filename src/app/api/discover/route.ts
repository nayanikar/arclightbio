import { NextRequest, NextResponse } from "next/server";
import { searchPubMed } from "@/api/pubmed";
import { generateHypothesis } from "@/lib/hypothesis";
import {
  createOpportunityObject,
  getOrgContext,
  listOrgContexts,
  DEFAULT_ORG_CONTEXTS,
} from "@/lib/db";
import { pickDefaultOrgContext } from "@/lib/orgContext";
import { classifyQuery } from "@/lib/queryClassifier";
import { scheduleBlackboardRun } from "@/lib/blackboard";
import { getActionabilityZoneFromConfidence } from "@/lib/scoring";
import type { DomainContext } from "@/types/OpportunityObject";

const VALID_DOMAIN_CONTEXTS: DomainContext[] = [
  "general",
  "oncology first-in-class",
  "autoimmune chronic",
  "sex-specific biology",
  "rare disease",
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      query,
      orgContextId,
      mode = "speed",
      domainContext = "general",
    } = body as {
      query: string;
      orgContextId?: string;
      mode?: "speed" | "depth";
      domainContext?: DomainContext;
    };

    if (!query?.trim()) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const resolvedDomain: DomainContext = VALID_DOMAIN_CONTEXTS.includes(
      domainContext
    )
      ? domainContext
      : "general";

    let orgId = orgContextId?.trim() || undefined;
    if (!orgId) {
      const contexts = await listOrgContexts();
      orgId =
        pickDefaultOrgContext(contexts)?.id ??
        DEFAULT_ORG_CONTEXTS[0].id;
    }

    const org = await getOrgContext(orgId);
    if (!org) {
      return NextResponse.json({ error: "Org context not found" }, { status: 404 });
    }

    const classification = await classifyQuery(query);

    const papers = await searchPubMed(query, mode === "depth" ? 15 : 10);
    const hypothesis = await generateHypothesis(
      query,
      papers,
      org,
      resolvedDomain
    );

    const obj = await createOpportunityObject({
      anchor_type: "human_prompted",
      hypothesis,
      org_context_id: orgId,
      search_query: query,
      mode,
      evidence_tier: classification.tier,
      query_tier: classification.tier,
      prior_score: classification.prior_score,
      domain_context: resolvedDomain,
    });

    scheduleBlackboardRun(obj.id);

    return NextResponse.json({
      id: obj.id,
      hypothesis,
      hypothesis_fallback: hypothesis.source === "fallback",
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
