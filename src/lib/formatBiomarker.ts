export type BiomarkerEntry =
  | string
  | {
      name?: string;
      type?: string;
      measurement?: string;
      rationale?: string;
      development_stage?: string;
    };

export function formatBiomarkerLabel(entry: BiomarkerEntry): string {
  if (typeof entry === "string") return entry;
  const parts = [entry.name, entry.type, entry.measurement].filter(Boolean);
  const head = parts.length > 0 ? parts.join(" · ") : "Biomarker";
  if (entry.development_stage) {
    return `${head} (${entry.development_stage})`;
  }
  return head;
}

export function normalizeBiomarkerItems(
  items: BiomarkerEntry[] | undefined | null
): string[] {
  if (!items?.length) return [];
  return items.map(formatBiomarkerLabel);
}
