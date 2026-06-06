export interface StructuredProse {
  summary: string;
  key_points: string[];
  detail?: string;
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"([{])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function groupIntoBullets(sentences: string[], maxPerBullet = 2): string[] {
  const bullets: string[] = [];
  for (let i = 0; i < sentences.length; i += maxPerBullet) {
    bullets.push(sentences.slice(i, i + maxPerBullet).join(" "));
  }
  return bullets;
}

export function structureLongText(text: string): StructuredProse {
  const trimmed = text?.trim() ?? "";
  if (!trimmed) {
    return { summary: "", key_points: [] };
  }

  const sentences = splitSentences(trimmed);
  if (sentences.length <= 2) {
    return { summary: trimmed, key_points: [] };
  }

  const summary = sentences[0];
  const remaining = sentences.slice(1);
  const key_points =
    remaining.length <= 3
      ? remaining
      : groupIntoBullets(remaining.slice(0, 6), 2);

  const detail =
    remaining.length > 6 ? remaining.slice(6).join(" ") : undefined;

  return { summary, key_points, detail };
}

export function normalizeStructuredProse(
  input: Partial<StructuredProse> | string | null | undefined
): StructuredProse {
  if (!input) return { summary: "", key_points: [] };
  if (typeof input === "string") return structureLongText(input);

  const summary = input.summary?.trim() ?? "";
  const key_points = (input.key_points ?? []).map((p) => p.trim()).filter(Boolean);
  const detail = input.detail?.trim();

  if (summary || key_points.length) {
    return {
      summary: summary || key_points[0] || "",
      key_points: summary ? key_points : key_points.slice(1),
      detail,
    };
  }

  return structureLongText(detail ?? "");
}
