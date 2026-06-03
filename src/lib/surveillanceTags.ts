import type { Hypothesis, SurveillanceTags } from "@/types/OpportunityObject";
import { callAgentJson } from "@/api/anthropic";

export const FIXED_SIGNAL_TAGS = [
  "new-trial-initiation",
  "patent-filing",
  "FDA-approval",
  "RWE-publication",
  "competitor-announcement",
] as const;

const GENERIC_SINGLE_WORDS = new Set([
  "inhibitor",
  "cancer",
  "disease",
  "therapy",
  "treatment",
  "drug",
  "protein",
  "patient",
  "clinical",
  "trial",
  "study",
  "research",
  "biomarker",
  "pathway",
  "mechanism",
  "target",
  "antibody",
  "vaccine",
  "diagnosis",
  "prognosis",
]);

const TAG_GENERATION_SYSTEM = `You are generating surveillance tags for a biomedical discovery platform. These tags will be used to monitor PubMed for new papers relevant to a specific hypothesis.

Return valid JSON only with keys: concept_tags, entity_tags. Do not include signal_tags.

Generate surveillance tags in two categories:

1. concept_tags (5-8 tags): Specific biological and clinical concepts. Must be precise enough that a PubMed search would return relevant papers.
   BAD: "inhibitor", "cancer", "disease"
   GOOD: "PD-1 checkpoint", "NSCLC immunotherapy", "STK11 mutation", "pembrolizumab resistance"

2. entity_tags (3-5 tags): Specific drugs, genes, trials, companies directly named or implied in the hypothesis.
   Examples: "pembrolizumab", "nivolumab", "PDCD1", "Aurora A kinase"

Tags must be 2-4 words maximum. No single generic words. Prefer multi-word phrases for concepts.`;

interface TagGenerationResponse {
  concept_tags?: string[];
  entity_tags?: string[];
}

function wordCount(tag: string): number {
  return tag.trim().split(/\s+/).filter(Boolean).length;
}

function isGenericSingleWord(tag: string): boolean {
  const words = tag.trim().split(/\s+/).filter(Boolean);
  if (words.length !== 1) return false;
  return GENERIC_SINGLE_WORDS.has(words[0].toLowerCase());
}

function sanitizeTags(
  tags: unknown,
  min: number,
  max: number,
  allowSingleSpecific = false
): string[] {
  if (!Array.isArray(tags)) return [];

  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of tags) {
    if (typeof raw !== "string") continue;
    const tag = raw.trim().replace(/\s+/g, " ");
    if (tag.length < 2 || tag.length > 48) continue;

    const words = wordCount(tag);
    if (words > 4) continue;
    if (words === 1 && !allowSingleSpecific && isGenericSingleWord(tag)) continue;
    if (words === 1 && !allowSingleSpecific) continue;

    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
    if (result.length >= max) break;
  }

  return result.length >= min ? result.slice(0, max) : result;
}

export async function generateSurveillanceTags(
  hypothesis: Hypothesis
): Promise<SurveillanceTags> {
  const userPrompt = `The hypothesis is: ${hypothesis.statement}
Patient population: ${hypothesis.patient_population}

Generate concept_tags (5-8) and entity_tags (3-5) as JSON: { "concept_tags": [...], "entity_tags": [...] }`;

  try {
    const result = await callAgentJson<TagGenerationResponse>(
      TAG_GENERATION_SYSTEM,
      userPrompt
    );

    const concept_tags = sanitizeTags(result.concept_tags, 5, 8, false);
    const entity_tags = sanitizeTags(result.entity_tags, 3, 5, true);

    return {
      concept_tags,
      entity_tags,
      signal_tags: [...FIXED_SIGNAL_TAGS],
    };
  } catch (err) {
    console.error("[generateSurveillanceTags]", err);
    return {
      concept_tags: [],
      entity_tags: [],
      signal_tags: [...FIXED_SIGNAL_TAGS],
    };
  }
}

export function surveillanceTagsNeedRegeneration(tags: SurveillanceTags): boolean {
  return tags.concept_tags.length === 0;
}
