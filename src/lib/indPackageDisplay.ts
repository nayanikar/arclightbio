import { clampWords } from "@/lib/compressProse";

export interface IndBullet {
  display: string;
  full: string;
}

/** Split compound agent bullets and shorten for glanceable display. */
export function formatIndBullets(items: string[], maxWords = 20): IndBullet[] {
  const out: IndBullet[] = [];

  for (const raw of items) {
    const trimmed = raw?.trim();
    if (!trimmed) continue;

    const parts = trimmed.split(/;\s+/).filter(Boolean);
    const segments = parts.length > 1 ? parts : [trimmed];

    for (const segment of segments) {
      const full = segment.replace(/\.\s*$/, "").trim();
      out.push({
        full,
        display: clampWords(full, maxWords),
      });
    }
  }

  return out;
}

export function isClamped(bullet: IndBullet): boolean {
  return bullet.full !== bullet.display;
}
