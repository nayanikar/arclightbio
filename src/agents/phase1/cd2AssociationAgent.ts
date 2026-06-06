import { callAgentJson } from "@/api/anthropic";
import { searchPubMed } from "@/api/pubmed";
import { getTargetDiseaseAssociations } from "@/api/openTargets";
import type { OpportunityObject } from "@/types/OpportunityObject";
import type { CD2Association } from "@/types/V3Pipeline";
import { expandSearchDomains } from "@/lib/literatureDomains";
import { updateV3OpportunityFields } from "@/lib/v3Db";
import { sanitizeScientificClaim } from "@/lib/scientificLanguage";
import {
  buildPhase1PromptHeader,
  formatAnchorBlock,
  JSON_ONLY_SUFFIX,
  loadPhase1Context,
} from "./shared";
import { discoverySystemPrompt, narrativeTemperature } from "@/lib/innovationProfile";

const SYSTEM = `You are the CD2 Association Agent for Arclight Bio V3 Phase 1.
Synthesize association domains independent of row-level cohort data using literature and target-disease associations.
Association types: disease, organ, molecular.

Return JSON array (max 8):
[{
  "domain": string,
  "association_type": "disease"|"organ"|"molecular",
  "association_claim": string (falsifiable),
  "evidence_sources": string[],
  "confidence": number (0-1),
  "pubmed_query": string
}]${JSON_ONLY_SUFFIX}`;

function extractTargetToken(query: string): string | null {
  const match = query.match(/\b([A-Z][A-Z0-9]{1,7})\b/);
  return match?.[1] ?? null;
}

export async function cd2AssociationAgent(
  obj: OpportunityObject
): Promise<CD2Association[]> {
  const ctx = await loadPhase1Context(obj);
  const query = ctx.search_query ?? ctx.hypothesis.statement;
  const domainContext =
    ctx.parent_domain === "oncology" ? "oncology first-in-class" : "general";

  const expandedDomains = await expandSearchDomains(query, domainContext);
  const pubmedResults = await Promise.allSettled(
    expandedDomains.slice(0, 3).map((d) => searchPubMed(d.pubmed_query, 5))
  );

  const pubmedSnippets = pubmedResults
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) =>
      r.value.map((p) => `PMID:${p.pmid} ${p.title.slice(0, 100)}`)
    )
    .slice(0, 12);

  const target = extractTargetToken(query);
  let otAssocs: Awaited<ReturnType<typeof getTargetDiseaseAssociations>> = [];
  if (target) {
    try {
      otAssocs = await getTargetDiseaseAssociations(target);
    } catch {
      otAssocs = [];
    }
  }

  const otBlock = otAssocs
    .slice(0, 8)
    .map((a) => `${a.targetName}–${a.diseaseName} (score ${a.score.toFixed(2)})`)
    .join("\n");

  let associations: CD2Association[];
  try {
    associations = await callAgentJson<CD2Association[]>(
      discoverySystemPrompt(SYSTEM, ctx),
      `${buildPhase1PromptHeader(ctx)}
${formatAnchorBlock(ctx.anchor_profiles)}

Expanded adjacent domains:
${expandedDomains.map((d) => `- ${d.domain}: ${d.adjacency_rationale}`).join("\n")}

PubMed snippets:
${pubmedSnippets.join("\n") || "none"}

Open Targets associations:
${otBlock || "none"}

Generate CD2 association domains bridging PD to adjacent fields.`,
      { temperature: narrativeTemperature(ctx) }
    );
    if (!Array.isArray(associations)) associations = [];
  } catch {
    associations = expandedDomains.slice(0, 4).map((d) => ({
      domain: d.domain,
      association_type: "molecular" as const,
      association_claim: `${d.domain} biology may associate with the program anchor via ${d.signal_type}.`,
      evidence_sources: ["pubmed_expansion"],
      confidence: 0.55,
      pubmed_query: d.pubmed_query,
    }));
  }

  const normalized = associations.slice(0, 8).map((a) => ({
    ...a,
    association_claim: sanitizeScientificClaim(a.association_claim),
    confidence: Math.min(1, Math.max(0, a.confidence ?? 0.5)),
  }));

  await updateV3OpportunityFields(ctx.id, {
    cd2_associations: normalized,
    v3_phase: "phase1:cd2",
  });
  return normalized;
}
