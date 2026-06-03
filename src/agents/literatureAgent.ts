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
import { ApiError } from "@/lib/http";

const LITERATURE_AGENT_SYSTEM = `You are the Literature Agent for Opportunity Space, built by Arclight Bio.
Detect patterns across paper abstracts relevant to the hypothesis.
Return JSON array of objects with: content (one-sentence claim), pmid, study_design, sample_size (number or null).
Quality over quantity — max 5 papers.`;

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
  options?: { surveillance?: boolean; partial?: boolean }
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
    },
  };
}

export async function literatureAgent(obj: OpportunityObject): Promise<void> {
  const query = obj.search_query ?? obj.hypothesis.statement;
  const maxResults = obj.mode === "depth" ? 40 : 20;
  let papers: Awaited<ReturnType<typeof searchPubMed>> = [];
  let partial = false;

  try {
    papers = await searchPubMed(query, maxResults);
  } catch (err) {
    partial = true;
    if (!(err instanceof ApiError)) throw err;
  }

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
      raw_source_metadata: { partial, query, paperCount: 0 },
    });
    return;
  }

  let cardOutputs: LiteratureCardOutput[] = [];
  try {
    const abstractBlock = papers
      .slice(0, 10)
      .map(
        (p) =>
          `PMID:${p.pmid}\nTitle:${p.title}\nAbstract:${p.abstract.slice(0, 400)}`
      )
      .join("\n\n");

    cardOutputs = await callAgentJson<LiteratureCardOutput[]>(
      LITERATURE_AGENT_SYSTEM,
      `Hypothesis: ${obj.hypothesis.statement}\n\nPapers:\n${abstractBlock}`
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
    await insertEvidenceCard(
      obj.id,
      buildPubMedEvidenceCard(paper, output.content, { partial })
    );
  }
}
