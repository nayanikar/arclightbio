/**
 * Display-time compression for agent-generated prose.
 * Applied at render/assembly — does not mutate stored agent output.
 */

export function firstSentence(text: string): string {
  const trimmed = text?.trim() ?? "";
  if (!trimmed) return "";

  const match = trimmed.match(/^(.+?[.!?])(?:\s+|$)/);
  if (match) return match[1].trim();

  return trimmed;
}

export function clampWords(text: string, maxWords: number): string {
  const trimmed = text?.trim() ?? "";
  if (!trimmed) return "";

  const words = trimmed.split(/\s+/);
  if (words.length <= maxWords) return trimmed;

  const clipped = words.slice(0, maxWords).join(" ");
  return `${clipped.replace(/[,;:]$/, "")}…`;
}

export function clampChars(text: string, maxChars: number): string {
  const trimmed = text?.trim() ?? "";
  if (!trimmed || trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars - 1).trimEnd()}…`;
}

/** Display-time compression for non-headline UI only (not discovery thesis). */
export function shortenForHeadline(text: string, maxWords = 16): string {
  const sentence = firstSentence(text);
  return clampWords(sentence, maxWords);
}

/** One-line field labels (population, rationale, unmet need). */
export function shortenForField(text: string, maxWords = 22): string {
  const sentence = firstSentence(text);
  return clampWords(sentence, maxWords);
}

/** Secondary supporting line under a metric or anchor card. */
export function shortenForSupporting(text: string, maxWords = 14): string {
  return clampWords(firstSentence(text), maxWords);
}
