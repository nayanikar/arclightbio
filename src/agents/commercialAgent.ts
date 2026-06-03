import type { OpportunityObject } from "@/types/OpportunityObject";
import { searchPatents } from "@/api/lens";
import { getAdverseEvents } from "@/api/openFda";
import { callAgentJson } from "@/api/anthropic";
import { insertEvidenceCard } from "@/lib/db";
import { computeCompositeQuality } from "@/lib/scoring";
import { getOrgContext } from "@/lib/db";
import { formatOrgContextForPrompt } from "@/lib/orgContext";
import { ApiError } from "@/lib/http";

const COMMERCIAL_SYSTEM = `You are the Commercial Agent for Opportunity Space by Arclight Bio.
Assess IP landscape and commercial fit given patent data and org context.
Return JSON: { content: string (2-3 sentences), competitive_position: string }`;

export async function commercialAgent(obj: OpportunityObject): Promise<void> {
  const query = obj.search_query ?? obj.hypothesis.statement;
  const org = await getOrgContext(obj.org_context_id);

  let patents: Awaited<ReturnType<typeof searchPatents>> = [];
  let fdaEvents: Awaited<ReturnType<typeof getAdverseEvents>> = [];
  let lensMissing = false;
  let partial = false;

  try {
    patents = await searchPatents(query.split(" ")[0], 10);
  } catch (err) {
    if (err instanceof ApiError && err.code === "MISSING_KEY") {
      lensMissing = true;
    } else {
      partial = true;
    }
  }

  const drugTerm = query.split(" ")[0];
  try {
    fdaEvents = await getAdverseEvents(drugTerm, 50);
  } catch {
    partial = true;
  }

  let content: string;
  try {
    const result = await callAgentJson<{ content: string; competitive_position: string }>(
      COMMERCIAL_SYSTEM,
      `Query: ${query}
${org ? formatOrgContextForPrompt(org) : "Organization: unknown"}
Commercial weights: ${JSON.stringify(org?.commercial_weights)}
Patents found: ${patents.length}
${patents.slice(0, 3).map((p) => p.title).join("; ")}
FDA adverse events: ${fdaEvents.length} unique reactions
${lensMissing ? "Note: Lens patent API unavailable — analysis based on OpenFDA only." : ""}`
    );
    content = result.content;
  } catch {
    const assignees = Array.from(new Set(patents.map((p) => p.assignee))).slice(0, 5);
    content = lensMissing
      ? `IP landscape partially assessed via OpenFDA (${fdaEvents.length} adverse event signals for ${drugTerm}). Lens patent search unavailable — add LENS_API_KEY for full IP analysis.`
      : `IP landscape: ${patents.length} patents found. Top assignees: ${assignees.join(", ") || "none"}. FDA signals: ${fdaEvents.length} reactions tracked.`;
  }

  const quality = {
    sample_size: Math.min(1, (patents.length + fdaEvents.length) / 20),
    study_design: 0.6,
    source_credibility: lensMissing ? 0.5 : 0.75,
    replication: 0.5,
    recency: 0.7,
  };

  await insertEvidenceCard(obj.id, {
    content: content + (partial ? " [Partial search]" : ""),
    source_url: patents[0]?.source_url ?? "https://api.fda.gov/",
    source_type: patents.length > 0 ? "patent" : "fda",
    contributing_agent: "commercial",
    quality_scores: { ...quality, composite: computeCompositeQuality(quality) },
    regulatory_weight: computeCompositeQuality(quality),
    raw_source_metadata: {
      patents: patents.slice(0, 10),
      fdaEvents: fdaEvents.slice(0, 10),
      lensMissing,
      partial,
      org_weights: org?.commercial_weights,
    },
  });
}
