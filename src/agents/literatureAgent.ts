import type { EvidenceCard, OpportunityObject } from "@/types/OpportunityObject";
import type { Paper } from "@/types/api";
import { searchPubMed } from "@/api/pubmed";
import { findRelatedPapers } from "@/api/semanticScholar";
import { callAgentJson } from "@/api/anthropic";
import { insertEvidenceCard } from "@/lib/db";
import { computeCompositeQuality } from "@/lib/scoring";
import {
  detectSampleSize as scoreSampleSizeFromContent,
  detectStudyDesign as scoreStudyDesignFromContent,
} from "@/lib/evidenceQuality";
import {
  dedupePapersByPmid,
  detectCrossDomainConnections,
  expandSearchDomains,
  type DomainPaperSet,
} from "@/lib/literatureDomains";

const INDICATION_SPECIFICITY_RULE = `Indication specificity rule: A paper is only relevant if it studies the same disease, condition, or patient population as the hypothesis, OR if it studies a mechanism that is directly and explicitly linked to the hypothesis disease in the paper itself.

Reject a paper if:
- It uses the same biomarker type or platform (e.g. exosomes, microRNAs, PD-L1) but in a completely different disease context with no mechanistic bridge to the hypothesis
- It is a general review of a technology that happens to mention the hypothesis disease in passing
- The only connection to the hypothesis is a shared experimental technique or assay method

Accept a paper if:
- It directly studies the hypothesis disease or indication
- It studies a mechanistically adjacent condition where the paper itself explicitly explains the connection
- It is a cross-domain signal where the mechanism bridges two fields in a way that is directly relevant to the hypothesis patient population

Examples of what to reject:
- Hypothesis is about ALS biomarkers → reject a breast cancer exosome paper unless it explicitly discusses motor neuron biology or ALS mechanisms
- Hypothesis is about lupus flares → reject a general estrogen receptor paper about osteoporosis unless it explicitly discusses immune modulation
- Hypothesis is about NSCLC immunotherapy → reject a pancreatic cancer checkpoint paper unless it explicitly discusses shared resistance mechanisms

The test: would a domain expert reading this paper say 'this is directly relevant to our hypothesis' or would they say 'interesting technique but wrong disease'? Only include papers that pass the domain expert test.`;

const LITERATURE_AGENT_SYSTEM = `You are the Literature Agent for Opportunity Space, built by Arclight Bio.
Review paper abstracts and return only those directly relevant to the hypothesis.
Return JSON array of objects with: content (one-sentence claim), pmid, study_design, sample_size (number or null).
Quality over quantity — max 5 papers.

Relevance criteria:
- The paper must support, contradict, or materially inform the specific hypothesis statement and patient population
- Prefer papers with explicit mechanistic or clinical connection to the hypothesis indication
- Exclude papers that match keywords but address a different disease without a stated mechanistic bridge

${INDICATION_SPECIFICITY_RULE}`;

interface LiteratureCardOutput {
  content: string;
  pmid: string;
  study_design: string;
  sample_size: number | null;
}

function detectStudyDesign(text: string): string {
  const lower = text.toLowerCase();

  if (lower.includes("meta-analysis")) return "meta_analysis";
  if (lower.includes("systematic review")) return "systematic_review";
  if (
    lower.includes("c. elegans") ||
    lower.includes("mouse model") ||
    lower.includes("animal model") ||
    lower.includes("murine model") ||
    lower.includes("rat model")
  ) {
    return "animal_model";
  }
  if (
    lower.includes("randomized") ||
    lower.includes("randomised") ||
    /\brct\b/.test(lower)
  ) {
    return "rct";
  }
  if (lower.includes("prospective cohort")) return "prospective_cohort";
  if (lower.includes("case report")) return "case_report";
  if (lower.includes("case series")) return "case_series";
  if (lower.includes("case-control") || lower.includes("case control")) {
    return "case_control";
  }
  if (lower.includes("retrospective")) return "retrospective";
  if (lower.includes("cross-sectional") || lower.includes("cross sectional")) {
    return "cross_sectional";
  }
  if (lower.includes("observational")) return "observational";

  return "observational";
}

function formatDesignLabel(design: string): string {
  const labels: Record<string, string> = {
    rct: "RCT",
    meta_analysis: "Meta-analysis",
    systematic_review: "Systematic review",
    prospective_cohort: "Prospective cohort",
    retrospective: "Retrospective",
    case_control: "Case-control",
    observational: "Observational",
    cross_sectional: "Cross-sectional",
    case_report: "Case report",
    case_series: "Case series",
    animal_model: "Animal model",
  };
  return labels[design] ?? "Observational";
}

function extractSampleSize(text: string): number | null {
  const patterns = [
    /\b[nN]\s*=\s*(\d+)/,
    /\b(\d+)\s+(?:patients|participants|subjects)\b/i,
    /\b(?:patients|participants|subjects)\s*[:(]?\s*(?:n\s*=\s*)?(\d+)\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const n = parseInt(match[1], 10);
      if (!Number.isNaN(n) && n > 0) return n;
    }
  }

  return null;
}

function scoreRecency(year: number): number {
  const ageYears = new Date().getFullYear() - year;
  if (ageYears <= 1) return 1.0;
  if (ageYears <= 3) return 0.8;
  if (ageYears <= 5) return 0.6;
  return 0.4;
}

function formatEvidenceContent(
  claim: string,
  design: string,
  sampleSize: number | null
): string {
  const prefix =
    sampleSize !== null
      ? `[${formatDesignLabel(design)}, N=${sampleSize}]`
      : `[${formatDesignLabel(design)}]`;

  if (claim.startsWith("[")) return claim;
  return `${prefix} ${claim}`;
}

export function buildPubMedEvidenceCard(
  paper: Paper,
  content: string,
  options?: {
    surveillance?: boolean;
    partial?: boolean;
    sourceDomain?: string;
  }
): Omit<EvidenceCard, "id" | "timestamp"> {
  const design = detectStudyDesign(paper.abstract);
  const sampleSize = extractSampleSize(paper.abstract);
  const formattedContent = formatEvidenceContent(content, design, sampleSize);

  const quality = {
    sample_size: scoreSampleSizeFromContent(formattedContent),
    study_design: scoreStudyDesignFromContent(formattedContent),
    source_credibility: paper.is_peer_reviewed !== false ? 0.85 : 0.4,
    replication: 0.4,
    recency: scoreRecency(paper.year),
  };

  const composite = computeCompositeQuality(quality);

  return {
    content: formattedContent,
    source_url: paper.source_url,
    source_type: "pubmed",
    contributing_agent: "literature",
    quality_scores: { ...quality, composite },
    regulatory_weight: composite,
    raw_source_metadata: {
      ...paper,
      study_design: design,
      sample_size: sampleSize,
      partial: options?.partial ?? false,
      surveillance: options?.surveillance ?? false,
      source_domain: options?.sourceDomain,
    },
  };
}

async function fetchMultiDomainPapers(
  obj: OpportunityObject
): Promise<{
  papers: Paper[];
  domainSets: DomainPaperSet[];
  partial: boolean;
  expandedDomainCount: number;
}> {
  const query = obj.search_query ?? obj.hypothesis.statement;
  const domainContext = obj.domain_context ?? "general";
  const anchorLimit = obj.mode === "depth" ? 20 : 15;
  const domainLimit = 15;
  let partial = false;

  const expandedDomains = await expandSearchDomains(query, domainContext);

  const searchTasks = [
    { domain: "Anchor query", query, limit: anchorLimit },
    ...expandedDomains.map((d) => ({
      domain: d.domain,
      query: d.pubmed_query,
      limit: domainLimit,
    })),
  ];

  const results = await Promise.allSettled(
    searchTasks.map((task) => searchPubMed(task.query, task.limit))
  );

  const domainSets: DomainPaperSet[] = [];
  const allPaperSets: Array<{ domain: string; papers: Paper[] }> = [];

  results.forEach((result, i) => {
    const task = searchTasks[i];
    if (result.status === "fulfilled") {
      domainSets.push({ domain: task.domain, papers: result.value });
      allPaperSets.push({ domain: task.domain, papers: result.value });
    } else {
      partial = true;
      domainSets.push({ domain: task.domain, papers: [] });
      allPaperSets.push({ domain: task.domain, papers: [] });
    }
  });

  const deduped = dedupePapersByPmid(allPaperSets);
  let papers = Array.from(deduped.values()).map((entry) => ({
    ...entry.paper,
    source_domains: entry.domains,
  })) as Paper[];

  if (obj.mode === "depth" && papers.length > 0) {
    try {
      const related = await findRelatedPapers(`PMID:${papers[0].pmid}`, 5);
      papers = [
        ...papers,
        ...related.filter((r) => !papers.some((p) => p.pmid === r.pmid)),
      ];
    } catch {
      partial = true;
    }
  }

  return {
    papers,
    domainSets,
    partial,
    expandedDomainCount: expandedDomains.length,
  };
}

async function postCrossDomainCards(
  obj: OpportunityObject,
  domainSets: DomainPaperSet[],
  partial: boolean
): Promise<void> {
  const connections = await detectCrossDomainConnections(
    obj.hypothesis.statement,
    domainSets.filter((ds) => ds.papers.length > 0)
  );

  for (const conn of connections) {
    const composite = Math.min(
      0.95,
      Math.max(0.55, conn.confidence ?? 0.72)
    );
    const content = `[Cross-domain: ${conn.domain_a} × ${conn.domain_b}] ${conn.claim} — Mechanism: ${conn.mechanism}. ${conn.novelty}`;

    await insertEvidenceCard(obj.id, {
      content,
      source_url: conn.supporting_papers[0]
        ? `https://pubmed.ncbi.nlm.nih.gov/${conn.supporting_papers[0]}/`
        : "",
      source_type: "pubmed",
      contributing_agent: "literature",
      is_cross_domain: true,
      quality_scores: {
        sample_size: 0.6,
        study_design: 0.7,
        source_credibility: 0.8,
        replication: 0.65,
        recency: 0.75,
        composite,
      },
      regulatory_weight: composite,
      raw_source_metadata: {
        domain_a: conn.domain_a,
        domain_b: conn.domain_b,
        mechanism: conn.mechanism,
        novelty: conn.novelty,
        supporting_pmids: conn.supporting_papers,
        partial,
      },
    });
  }
}

export async function literatureAgent(obj: OpportunityObject): Promise<void> {
  const query = obj.search_query ?? obj.hypothesis.statement;
  const { papers, domainSets, partial, expandedDomainCount } =
    await fetchMultiDomainPapers(obj);

  if (papers.length === 0) {
    await insertEvidenceCard(obj.id, {
      content: partial
        ? `Literature search incomplete — PubMed query timed out or failed for "${query}". Partial search flagged.`
        : `No PubMed results found for "${query}".`,
      source_url: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(query)}`,
      source_type: "pubmed",
      contributing_agent: "literature",
      quality_scores: {
        sample_size: 0.3,
        study_design: 0.3,
        source_credibility: 0.4,
        replication: 0.3,
        recency: 0.5,
        composite: 0.35,
      },
      regulatory_weight: 0.35,
      raw_source_metadata: {
        partial,
        query,
        paperCount: 0,
        expandedDomainCount,
      },
    });
    return;
  }

  await postCrossDomainCards(obj, domainSets, partial);

  let cardOutputs: LiteratureCardOutput[] = [];
  try {
    const abstractBlock = papers
      .slice(0, 12)
      .map(
        (p) =>
          `PMID:${p.pmid}\nTitle:${p.title}\nAbstract:${p.abstract.slice(0, 400)}`
      )
      .join("\n\n");

    cardOutputs = await callAgentJson<LiteratureCardOutput[]>(
      LITERATURE_AGENT_SYSTEM,
      `Hypothesis: ${obj.hypothesis.statement}
Patient population: ${obj.hypothesis.patient_population}
Unmet need: ${obj.hypothesis.unmet_need}
Domain context: ${obj.domain_context ?? "general"}
Domains searched: ${domainSets.map((d) => d.domain).join(", ")}

Apply the indication specificity rule strictly. Only return papers that pass the domain expert test.

Papers:
${abstractBlock}`
    );
  } catch {
    cardOutputs = papers.slice(0, 5).map((p) => ({
      content: p.title,
      pmid: p.pmid,
      study_design: detectStudyDesign(p.abstract),
      sample_size: extractSampleSize(p.abstract),
    }));
  }

  for (const output of cardOutputs.slice(0, 5)) {
    const paper = papers.find((p) => p.pmid === output.pmid) ?? papers[0];
    const sourceDomain =
      (paper as Paper & { source_domains?: string[] }).source_domains?.[0];
    await insertEvidenceCard(
      obj.id,
      buildPubMedEvidenceCard(paper, output.content, { partial, sourceDomain })
    );
  }
}
