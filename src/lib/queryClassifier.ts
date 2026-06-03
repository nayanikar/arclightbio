import { callAgent } from "@/api/anthropic";
import type { EvidenceTier } from "@/types/OpportunityObject";
import { priorScoreForTier, TIER_PRIORS } from "@/lib/evidenceTier";

export type { EvidenceTier };

export const PRIOR_MAP = TIER_PRIORS;

export interface QueryClassification {
  tier: EvidenceTier;
  reasoning: string;
  prior_score: number;
}

const TIER_CLASSIFIER_SYSTEM =
  "You classify biomedical research queries by evidence maturity. Return valid JSON only, no markdown fences or other text.";

function buildTierClassifierPrompt(searchQuery: string): string {
  return `
Classify this biomedical research query into exactly one tier.

Query: "${searchQuery}"

Rules:
- PRECLINICAL: field has no approved human therapy, 
  research is primarily in cell lines or animal models,
  human trials are Phase 0-1 only or nonexistent,
  the specific mechanism has not been validated in humans.
  Keywords that suggest preclinical: microRNA, exosome, 
  circular RNA, epigenetic biomarker, telomere, 
  mitochondrial replacement, organoid, CRISPR in early disease

- ESTABLISHED: approved drugs exist specifically for 
  this indication and mechanism, multiple Phase 3 RCTs 
  published, major pharma actively competing with 
  approved products RIGHT NOW.
  Keywords that suggest established: trastuzumab, 
  pembrolizumab first-line, nivolumab, osimertinib,
  imatinib, any drug name + "approved" + major indication

- CLINICAL: everything between preclinical and established.
  Human trials exist and are active, mechanism validated 
  in humans, but no approved therapy yet for this specific 
  approach, or approved therapy exists but this query 
  targets a novel subgroup or combination.

You MUST return valid JSON only, no other text:
{"tier": "preclinical" | "clinical" | "established"}
`.trim();
}

function normalizeTier(raw: string | undefined): EvidenceTier {
  const value = (raw ?? "clinical").toLowerCase().trim();
  if (value === "preclinical" || value.includes("preclinical")) {
    return "preclinical";
  }
  if (value === "established" || value.includes("established")) {
    return "established";
  }
  return "clinical";
}

function heuristicClassification(searchQuery: string): QueryClassification {
  const q = searchQuery.toLowerCase();

  const establishedSignals = [
    "trastuzumab",
    "pembrolizumab",
    "nivolumab",
    "osimertinib",
    "imatinib",
    "first-line",
    "first line",
    "approved",
  ];
  const preclinicalSignals = [
    "exosome",
    "microrna",
    "mirna",
    "circular rna",
    "epigenetic biomarker",
    "telomere",
    "mitochondrial replacement",
    "organoid",
    "crispr",
  ];

  if (establishedSignals.some((signal) => q.includes(signal))) {
    return {
      tier: "established",
      reasoning: "Heuristic fallback: established therapy signals in query.",
      prior_score: PRIOR_MAP.established,
    };
  }

  if (preclinicalSignals.some((signal) => q.includes(signal))) {
    return {
      tier: "preclinical",
      reasoning: "Heuristic fallback: preclinical mechanism signals in query.",
      prior_score: PRIOR_MAP.preclinical,
    };
  }

  return {
    tier: "clinical",
    reasoning: "Heuristic fallback: active clinical investigation assumed.",
    prior_score: PRIOR_MAP.clinical,
  };
}

export async function classifyQuery(
  searchQuery: string
): Promise<QueryClassification> {
  const trimmed = searchQuery.trim();
  if (!trimmed) {
    console.log("[classifier] Empty query — defaulting to clinical");
    return heuristicClassification("unknown");
  }

  console.log("Classifying query:", trimmed);

  try {
    const response = await callAgent(
      TIER_CLASSIFIER_SYSTEM,
      buildTierClassifierPrompt(trimmed)
    );
    console.log("Classifier response:", response);

    const cleaned = response.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(cleaned) as { tier?: string };
    console.log("Parsed tier:", parsed.tier);

    const tier = normalizeTier(parsed.tier);
    const prior_score = PRIOR_MAP[tier] ?? 0.45;

    return {
      tier,
      reasoning: `Claude classified as ${tier}`,
      prior_score,
    };
  } catch (err) {
    console.error("[classifier] Claude call or JSON parse failed:", err);
    const fallback = heuristicClassification(trimmed);
    console.log("[classifier] Using heuristic fallback:", fallback.tier);
    return fallback;
  }
}

export function priorForTier(tier: EvidenceTier): number {
  return priorScoreForTier(tier);
}
