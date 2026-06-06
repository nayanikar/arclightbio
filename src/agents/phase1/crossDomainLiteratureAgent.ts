import type { OpportunityObject } from "@/types/OpportunityObject";
import { searchPubMed } from "@/api/pubmed";
import { searchPatents } from "@/api/lens";
import { searchTrialsByTerm } from "@/api/clinicalTrials";
import { callAgentJson } from "@/api/anthropic";
import { insertEvidenceCard } from "@/lib/db";
import { expandSearchDomains } from "@/lib/literatureDomains";
import { updateV3OpportunityFields } from "@/lib/v3Db";
import { sanitizeScientificClaim } from "@/lib/scientificLanguage";
import { getActiveTrailCapture } from "@/lib/trailCapture";
import {
  buildPhase1PromptHeader,
  defaultInternalQuality,
  formatExpertDomains,
  JSON_ONLY_SUFFIX,
  loadPhase1Context,
} from "./shared";
import { discoverySystemPrompt, narrativeTemperature } from "@/lib/innovationProfile";

const SYSTEM = `You are the Cross-Domain Literature Agent for Arclight Bio V3 Phase 1.
Review multi-source evidence (PubMed, trials, patents) for parent domain + each expert domain.
Return JSON array (max 8 cards):
[{ "content": string, "source_type": "pubmed"|"clinicaltrials"|"patent", "source_url": string, "domain": string }]${JSON_ONLY_SUFFIX}`;

interface LitCard {
  content: string;
  source_type: "pubmed" | "clinicaltrials" | "patent";
  source_url: string;
  domain: string;
}

export async function crossDomainLiteratureAgent(
  obj: OpportunityObject
): Promise<void> {
  const ctx = await loadPhase1Context(obj);
  const query = ctx.search_query ?? ctx.hypothesis.statement;
  const domains = ctx.expert_domains ?? [];
  const expanded = await expandSearchDomains(
    query,
    ctx.parent_domain === "oncology" ? "oncology first-in-class" : "general"
  );

  const searchTasks = [
    { label: "Parent domain", query },
    ...domains.slice(0, 4).map((d) => ({ label: d.domain, query: `${query} ${d.domain}` })),
    ...expanded.slice(0, 2).map((d) => ({ label: d.domain, query: d.pubmed_query })),
  ];

  const [pubmedBatches, trialBatches, patentBatches] = await Promise.all([
    Promise.allSettled(searchTasks.map((t) => searchPubMed(t.query, 5))),
    Promise.allSettled(searchTasks.map((t) => searchTrialsByTerm(t.query, 3))),
    Promise.allSettled(searchTasks.map((t) => searchPatents(t.query, 3))),
  ]);

  const evidenceBlock: string[] = [];
  const trail = getActiveTrailCapture();
  pubmedBatches.forEach((r, i) => {
    if (r.status === "fulfilled") {
      for (const p of r.value.slice(0, 3)) {
        evidenceBlock.push(
          `[${searchTasks[i].label}] PMID:${p.pmid} ${p.title} — ${p.abstract.slice(0, 180)}`
        );
        trail?.addSource({
          label: `PMID ${p.pmid}`,
          url: `https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/`,
          type: "pubmed",
          excerpt: p.title,
        });
      }
    }
  });
  trialBatches.forEach((r, i) => {
    if (r.status === "fulfilled") {
      for (const t of r.value.slice(0, 2)) {
        evidenceBlock.push(
          `[${searchTasks[i].label}] TRIAL:${t.nctId} ${t.title} — ${t.status}`
        );
        trail?.addSource({
          label: t.nctId,
          url: `https://clinicaltrials.gov/study/${t.nctId}`,
          type: "clinicaltrials",
          excerpt: t.title,
        });
      }
    }
  });
  patentBatches.forEach((r, i) => {
    if (r.status === "fulfilled") {
      for (const p of r.value.slice(0, 2)) {
        evidenceBlock.push(`[${searchTasks[i].label}] PATENT: ${p.title}`);
        trail?.addSource({
          label: p.title.slice(0, 60),
          url:
            p.source_url ??
            `https://www.lens.org/lens/search/patent/list?q=${encodeURIComponent(p.title)}`,
          type: "patent",
          excerpt: p.title,
        });
      }
    }
  });

  let cards: LitCard[] = [];
  try {
    cards = await callAgentJson<LitCard[]>(
      discoverySystemPrompt(SYSTEM, ctx),
      `${buildPhase1PromptHeader(ctx)}
Expert domains:
${formatExpertDomains(domains)}

Retrieved evidence:
${evidenceBlock.slice(0, 25).join("\n")}`,
      { temperature: narrativeTemperature(ctx) }
    );
    if (!Array.isArray(cards)) cards = [];
  } catch {
    cards = evidenceBlock.slice(0, 5).map((line, i) => ({
      content: line.slice(0, 220),
      source_type: "pubmed" as const,
      source_url: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(query)}`,
      domain: domains[i % Math.max(domains.length, 1)]?.domain ?? "Parent domain",
    }));
  }

  trail?.setSummary(
    `Reviewed ${evidenceBlock.length} retrieved sources across ${searchTasks.length} domain queries; synthesized ${cards.length} evidence cards.`
  );

  const quality = defaultInternalQuality(evidenceBlock.length === 0);
  for (const card of cards.slice(0, 8)) {
    await insertEvidenceCard(ctx.id, {
      content: sanitizeScientificClaim(`[${card.domain}] ${card.content}`),
      source_url: card.source_url,
      source_type: card.source_type,
      contributing_agent: "literature",
      is_cross_domain: card.domain !== "Parent domain",
      quality_scores: quality,
      regulatory_weight: quality.composite,
      raw_source_metadata: {
        phase1_agent: "crossDomainLiteratureAgent",
        domain: card.domain,
      },
    });
  }

  await updateV3OpportunityFields(ctx.id, { v3_phase: "phase1:literature_review" });
}
