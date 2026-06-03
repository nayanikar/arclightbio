import type { OpportunityObject } from "@/types/OpportunityObject";
import type { OrganizationContext } from "@/types/OrganizationContext";
import { callAgentJson } from "@/api/anthropic";
import type { Paper } from "@/types/api";
import { formatOrgContextForPrompt } from "@/lib/orgContext";

const HYPOTHESIS_SYSTEM = `You are the hypothesis generator for Opportunity Space by Arclight Bio.
Given a search query, organization context, and real PubMed abstracts, generate a structured hypothesis.
Return JSON with keys: statement, patient_population, unmet_need, org_positioning.
Ground every field in the actual evidence provided. Do not use generic placeholder text.
The org_positioning field MUST describe strategic fit for the specified organization only — use their approved assets, pipeline, and therapeutic areas. Never reference a different company.`;

export async function generateHypothesis(
  query: string,
  papers: Paper[],
  org: OrganizationContext
): Promise<OpportunityObject["hypothesis"]> {
  const abstractSummary = papers
    .slice(0, 10)
    .map(
      (p, i) =>
        `[${i + 1}] ${p.title}\nAbstract: ${p.abstract.slice(0, 500)}\nPMID: ${p.pmid}`
    )
    .join("\n\n");

  const orgBlock = formatOrgContextForPrompt(org);

  try {
    return await callAgentJson<OpportunityObject["hypothesis"]>(
      HYPOTHESIS_SYSTEM,
      `Search query: "${query}"

${orgBlock}

IMPORTANT: Write org_positioning for ${org.org_name} only. Reference their portfolio assets and therapeutic areas listed above.

PubMed abstracts:
${abstractSummary || "No papers found yet — generate hypothesis from query terms only."}`
    );
  } catch {
    return {
      statement: `Cross-domain opportunity at the intersection of: ${query}`,
      patient_population: `Patients relevant to ${query}`,
      unmet_need: `Evidence gap identified through live literature search on "${query}"`,
      org_positioning: `${org.org_name} could explore this space given portfolio alignment in ${org.portfolio.therapeutic_areas.join(", ")}`,
    };
  }
}

export function extractKeywords(query: string, hypothesis: OpportunityObject["hypothesis"]): {
  conditions: string[];
  interventions: string[];
  targets: string[];
} {
  const text = `${query} ${hypothesis.statement} ${hypothesis.patient_population}`;
  const words = text
    .split(/[\s,;/]+/)
    .filter((w) => w.length > 3)
    .slice(0, 10);

  const conditions = words.slice(0, 3);
  const interventions = words.slice(1, 4);
  const targets = words.filter((w) => /^[A-Z]{2,}/.test(w) || w.includes("-"));

  return {
    conditions: conditions.length ? conditions : [query],
    interventions: interventions.length ? interventions : [query.split(" ")[0]],
    targets: targets.length ? targets : [query.split(" ")[0]],
  };
}
