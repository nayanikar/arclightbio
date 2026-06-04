import type { DomainContext } from "@/types/OpportunityObject";
import type { Paper } from "@/types/api";
import { callAgentJson } from "@/api/anthropic";
import { DOMAIN_CONTEXT_ADJUSTMENTS } from "@/lib/domainContext";

export interface ExpandedDomain {
  domain: string;
  pubmed_query: string;
  adjacency_rationale: string;
  signal_type:
    | "mechanism_overlap"
    | "pathway_shared"
    | "biomarker_shared"
    | "population_overlap";
}

export interface DomainPaperSet {
  domain: string;
  papers: Paper[];
}

export interface CrossDomainConnection {
  claim: string;
  domain_a: string;
  domain_b: string;
  mechanism: string;
  novelty: string;
  supporting_papers: string[];
  confidence?: number;
}

const DOMAIN_EXPANSION_SYSTEM = `You are a biomedical domain mapper for a cross-domain discovery system.
Return valid JSON only — a JSON array.`;

export async function expandSearchDomains(
  anchor: string,
  domainContext: DomainContext
): Promise<ExpandedDomain[]> {
  const adjustments = DOMAIN_CONTEXT_ADJUSTMENTS[domainContext];
  const mandatoryBlock = adjustments?.mandatory_domains.length
    ? `\nMandatory domains to include (merge with your suggestions): ${adjustments.mandatory_domains.join("; ")}`
    : "";

  const prompt = `Given this research anchor: "${anchor}"
And this domain context flag: "${domainContext}"
${mandatoryBlock}

Generate 3-4 adjacent scientific domains that are rarely read simultaneously with the primary domain but may contain mechanistic insights directly relevant to the anchor.

For each domain generate:
1. A specific PubMed search query (MeSH terms preferred)
2. Why this domain is mechanistically adjacent
3. What type of cross-domain signal to look for

Return as JSON array:
[{
  "domain": string,
  "pubmed_query": string,
  "adjacency_rationale": string,
  "signal_type": "mechanism_overlap" | "pathway_shared" | "biomarker_shared" | "population_overlap"
}]

Maximum 4 domains. Quality over quantity.`;

  try {
    const expanded = await callAgentJson<ExpandedDomain[]>(
      DOMAIN_EXPANSION_SYSTEM,
      prompt
    );
    if (!Array.isArray(expanded) || expanded.length === 0) {
      return fallbackDomains(anchor, domainContext);
    }
    return expanded.slice(0, 4);
  } catch {
    return fallbackDomains(anchor, domainContext);
  }
}

function fallbackDomains(
  anchor: string,
  domainContext: DomainContext
): ExpandedDomain[] {
  const adjustments = DOMAIN_CONTEXT_ADJUSTMENTS[domainContext];
  const mandatory = adjustments?.mandatory_domains ?? [];
  const base = mandatory.slice(0, 3).map((q) => ({
    domain: q.split(" ")[0] ?? q,
    pubmed_query: `${q} AND (${anchor.split(" ").slice(0, 3).join(" ")})`,
    adjacency_rationale: "Domain context mandatory search",
    signal_type: "mechanism_overlap" as const,
  }));

  if (base.length >= 2) return base;

  return [
    {
      domain: "Primary anchor",
      pubmed_query: anchor,
      adjacency_rationale: "Direct anchor search",
      signal_type: "mechanism_overlap",
    },
    {
      domain: "Adjacent mechanism",
      pubmed_query: `${anchor} mechanism pathway`,
      adjacency_rationale: "Mechanistic adjacency to anchor",
      signal_type: "pathway_shared",
    },
  ];
}

const CROSS_CITATION_SYSTEM = `You are a cross-domain biomedical discovery analyst.
In claim and mechanism fields, use precise pharmacology language: intervention class + target, hedged inferential claims.
Return valid JSON only — a JSON array of cross-domain connections.`;

export async function detectCrossDomainConnections(
  hypothesis: string,
  domainSets: DomainPaperSet[]
): Promise<CrossDomainConnection[]> {
  if (domainSets.length < 2) return [];

  const domainSummaries = domainSets
    .map(
      (ds) =>
        `Domain "${ds.domain}" (${ds.papers.length} papers):\n${ds.papers
          .slice(0, 8)
          .map(
            (p) =>
              `- PMID:${p.pmid} | ${p.title.slice(0, 80)} | ${p.abstract.slice(0, 120)}`
          )
          .join("\n")}`
    )
    .join("\n\n");

  const prompt = `You have papers from ${domainSets.length} different scientific domains retrieved for this hypothesis: "${hypothesis}"

${domainSummaries}

Identify:
1. Papers that appear in multiple domain sets (direct cross-citation)
2. Papers that explicitly cite mechanisms from an adjacent domain
3. The strongest cross-domain signal — where does domain A's finding directly explain a phenomenon in domain B?

Return the top 3-5 cross-domain connections as:
[{
  "claim": string,
  "domain_a": string,
  "domain_b": string,
  "mechanism": string,
  "novelty": string,
  "supporting_papers": string[],
  "confidence": number
}]

These are the highest-value outputs of the system. Focus on mechanistic bridges not obvious from single-domain search.`;

  try {
    const connections = await callAgentJson<CrossDomainConnection[]>(
      CROSS_CITATION_SYSTEM,
      prompt
    );
    return Array.isArray(connections) ? connections.slice(0, 5) : [];
  } catch {
    return [];
  }
}

export function dedupePapersByPmid(
  paperSets: Array<{ domain: string; papers: Paper[] }>
): Map<string, { paper: Paper; domains: string[] }> {
  const map = new Map<string, { paper: Paper; domains: string[] }>();

  for (const { domain, papers } of paperSets) {
    for (const paper of papers) {
      const existing = map.get(paper.pmid);
      if (existing) {
        if (!existing.domains.includes(domain)) {
          existing.domains.push(domain);
        }
      } else {
        map.set(paper.pmid, { paper, domains: [domain] });
      }
    }
  }

  return map;
}
