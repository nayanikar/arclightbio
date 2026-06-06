import type { InnovationLevel } from "@/types/V3Pipeline";
import { innovationDiscoveryAddon } from "@/lib/innovationProfile";

/**
 * Central biomedical writing standard for agent-generated text.
 * Applied to all LLM system prompts and evidence card content before storage.
 */

export const SCIENTIFIC_WRITING_RULES = `
Scientific writing rules (apply to all generated text):
1. Entity precision: distinguish gene/target symbols (e.g. TLR7, TTR) from interventions (agonist, antagonist, inhibitor, modulator, mAb, ADC) from drug names (INN/generic) from indications.
2. Never write "{TARGET} is approved" — approval applies to a drug product with a defined mechanism in an indication (e.g. "A TLR7 agonist is approved for …", not "TLR7 is approved").
3. Use intervention-class nouns: "JAK inhibitor", "TLR7 agonist", "PD-1 antagonist" — not bare "agonism/antagonism/inhibition" as shorthand for a therapeutic class.
4. Preserve valid mechanistic terms in context: "reverse agonism", "partial agonism", "pathway agonism" when describing biology, not product class.
5. Hedge agent-inferred claims: "evidence suggests", "consistent with", "preliminary data indicate". Use definitive language only for API-sourced facts (trial counts, named approvals).
6. Name therapeutic modality when recommending development: small molecule, monoclonal antibody, ADC, siRNA, gene therapy, etc.
7. First-in-class claims must specify mechanism-in-indication, not target alone.
`.trim();

export const SCIENTIFIC_WRITING_EXAMPLES = `
Examples (bad → good):
- "TLR7 agonism may treat lupus" → "A TLR7 agonist may have therapeutic potential in lupus"
- "TLR7 is approved" → "A TLR7 agonist is approved for [indication]" (name drug if known)
- "JAK inhibition in RA" → "JAK inhibitor therapy in rheumatoid arthritis"
- "TTR is an approved therapy" → "Tafamidis (a TTR stabilizer) is approved for ATTR cardiomyopathy"
- "First-in-class for TLR7" → "First-in-class TLR7 agonist in [indication] (no prior approved agent in class)"
`.trim();

const SCIENTIFIC_WRITING_BLOCK = `${SCIENTIFIC_WRITING_RULES}\n\n${SCIENTIFIC_WRITING_EXAMPLES}`;

export const OUTPUT_STRUCTURE_RULES = `
Output structure rules:
- Lead with a one-sentence takeaway.
- Follow with 3-5 bullet points for mechanistic rationale, risks, and precedent.
- Use short paragraphs (max 2 sentences) for remaining detail.
- Do not compress meaning; reorganize for scanability.
`.trim();

export function withScientificWritingRules(systemPrompt: string): string {
  return `${systemPrompt.trim()}\n\n---\n${SCIENTIFIC_WRITING_BLOCK}\n\n${OUTPUT_STRUCTURE_RULES}`;
}

export function withDiscoveryMindset(
  systemPrompt: string,
  level: InnovationLevel = "highest"
): string {
  return `${systemPrompt.trim()}\n\n${innovationDiscoveryAddon(level)}`;
}

/** Mechanistic phrases where "agonism/antagonism" should not be rewritten. */
const MECHANISM_AGONISM_PATTERN =
  /\b(reverse|partial|intrinsic|biased|pathway|receptor|constitutive)\s+agonism\b/i;

/** Target symbol followed by approval language without intervention class. */
const TARGET_APPROVED_PATTERN =
  /\b([A-Z][A-Z0-9]{1,7})\b\s+is\s+(?:FDA-)?approved\b/gi;

/** Standalone therapeutic-class "agonism" (not preceded by mechanistic qualifier). */
const TARGET_INTERVENTION_HINTS: Record<string, string> = {
  TLR7: "TLR7 agonist",
  TLR8: "TLR8 agonist",
  JAK1: "JAK inhibitor",
  JAK2: "JAK inhibitor",
  JAK3: "JAK inhibitor",
  TYK2: "TYK2 inhibitor",
  PD1: "PD-1 antagonist",
  PDCD1: "PD-1 antagonist",
  PDL1: "PD-L1 antagonist",
  CD274: "PD-L1 antagonist",
  TTR: "TTR stabilizer",
  TNF: "TNF inhibitor",
  IL6: "IL-6 inhibitor",
  IL17: "IL-17 inhibitor",
  EGFR: "EGFR inhibitor",
  BTK: "BTK inhibitor",
};

function interventionHintForTarget(target: string): string {
  const key = target.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return TARGET_INTERVENTION_HINTS[key] ?? `${target}-targeted agent`;
}

function fixBareAgonism(text: string): string {
  if (MECHANISM_AGONISM_PATTERN.test(text)) {
    return text;
  }

  let result = text.replace(
    /\b([A-Z][A-Z0-9]{1,7})\s+agonism\b/gi,
    "$1 agonist"
  );
  result = result.replace(/\bagonism\b/gi, "agonist");
  return result;
}

function fixTargetApprovedClaims(text: string): string {
  return text.replace(TARGET_APPROVED_PATTERN, (full, target: string) => {
    const hint = interventionHintForTarget(target);
    return `A ${hint} is approved`;
  });
}

/**
 * Deterministic post-processor for high-confidence unscientific patterns.
 * Only fixes known bad patterns; does not rewrite valid mechanistic language.
 */
export function sanitizeScientificClaim(text: string): string {
  if (!text?.trim()) return text;

  let result = text;
  result = fixTargetApprovedClaims(result);
  result = fixBareAgonism(result);
  return result;
}

export function sanitizeHypothesisFields(hypothesis: {
  statement: string;
  patient_population: string;
  unmet_need: string;
  org_positioning: string;
  source?: "llm" | "fallback" | "outgroup";
}): typeof hypothesis {
  return {
    statement: sanitizeScientificClaim(hypothesis.statement),
    patient_population: sanitizeScientificClaim(hypothesis.patient_population),
    unmet_need: sanitizeScientificClaim(hypothesis.unmet_need),
    org_positioning: sanitizeScientificClaim(hypothesis.org_positioning),
    ...(hypothesis.source ? { source: hypothesis.source } : {}),
  };
}
