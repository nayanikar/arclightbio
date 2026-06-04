import type { DomainContext, OpportunityObject } from "@/types/OpportunityObject";
import type { OrganizationContext } from "@/types/OrganizationContext";
import { callAgentJson } from "@/api/anthropic";
import type { Paper } from "@/types/api";
import { formatOrgContextForPrompt } from "@/lib/orgContext";
import { getHypothesisInstruction } from "@/lib/domainContext";
import { sanitizeHypothesisFields } from "@/lib/scientificLanguage";

const HYPOTHESIS_SYSTEM = `You are the hypothesis generator for Opportunity Space by Arclight Bio.
Given a search query, organization context, and real PubMed abstracts, generate a structured hypothesis.
Return JSON with keys: statement, patient_population, unmet_need, org_positioning.
Ground every field in the actual evidence provided. Do not use generic placeholder text.
The org_positioning field MUST describe strategic fit for the specified organization only — use their approved assets, pipeline, and therapeutic areas. Never reference a different company.
When describing therapies, name the intervention class (e.g. TLR7 agonist, JAK inhibitor) or drug (INN/generic) — never write that a gene/target symbol alone is approved.`;

export async function generateHypothesis(
  query: string,
  papers: Paper[],
  org: OrganizationContext,
  domainContext?: DomainContext
): Promise<OpportunityObject["hypothesis"]> {
  const abstractSummary = papers
    .slice(0, 10)
    .map(
      (p, i) =>
        `[${i + 1}] ${p.title}\nAbstract: ${p.abstract.slice(0, 500)}\nPMID: ${p.pmid}`
    )
    .join("\n\n");

  const orgBlock = formatOrgContextForPrompt(org);
  const domainInstruction = getHypothesisInstruction(domainContext);
  const domainBlock = domainInstruction
    ? `\nDomain context (${domainContext}): ${domainInstruction}\n`
    : "";

  try {
    const hypothesis = await callAgentJson<OpportunityObject["hypothesis"]>(
      HYPOTHESIS_SYSTEM,
      `Search query: "${query}"

${orgBlock}
${domainBlock}
IMPORTANT: Write org_positioning for ${org.org_name} only. Reference their portfolio assets and therapeutic areas listed above.

PubMed abstracts:
${abstractSummary || "No papers found yet — generate hypothesis from query terms only."}`
    );
    return sanitizeHypothesisFields({ ...hypothesis, source: "llm" });
  } catch {
    return sanitizeHypothesisFields({
      source: "fallback",
      statement: `[Unverified placeholder hypothesis] Preliminary cross-domain opportunity consistent with: ${query}`,
      patient_population: `Patients with ${query}-relevant disease indications`,
      unmet_need: `Evidence suggests an unmet need in ${query}; further validation required`,
      org_positioning: `${org.org_name} may explore this space given portfolio alignment in ${org.portfolio.therapeutic_areas.join(", ")}`,
    });
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
