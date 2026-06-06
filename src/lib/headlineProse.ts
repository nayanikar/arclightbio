import { callAgentJson } from "@/api/anthropic";

/** Program headline / discovery thesis word budget (agent-generated, not display-clipped). */
export const HEADLINE_MAX_WORDS = 18;

export function countWords(text: string): number {
  return (text ?? "").trim().split(/\s+/).filter(Boolean).length;
}

export function isWithinWordLimit(text: string, maxWords = HEADLINE_MAX_WORDS): boolean {
  return countWords(text) <= maxWords;
}

/**
 * When agent output exceeds the headline budget, rewrite via LLM — never truncate with ellipsis.
 */
export async function ensureGeneratedHeadline(
  text: string,
  maxWords = HEADLINE_MAX_WORDS,
  context = "discovery program headline"
): Promise<string> {
  const trimmed = text?.trim() ?? "";
  if (!trimmed || isWithinWordLimit(trimmed, maxWords)) return trimmed;

  const payload = await callAgentJson<{ headline: string }>(
    `Rewrite the text as one declarative sentence of at most ${maxWords} words.
Complete the thought within the word limit. Do not use ellipsis or mid-word cuts.
Return JSON: { "headline": string }`,
    `Context: ${context}\n\nText:\n${trimmed}`
  );

  const rewritten = payload.headline?.trim() ?? trimmed;
  if (!isWithinWordLimit(rewritten, maxWords)) {
    console.warn(
      `[headlineProse] Rewrite still exceeds ${maxWords} words (${countWords(rewritten)}): ${rewritten}`
    );
  }
  return rewritten;
}
