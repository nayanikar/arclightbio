import type { EvidenceCard } from "@/types/OpportunityObject";

export type InterventionDirection =
  | "antagonist"
  | "agonist"
  | "inhibitor"
  | "modulator"
  | "unknown";

export interface DirectionAudit {
  claimed_direction: InterventionDirection;
  supporting_evidence: string[];
  contradicting_evidence: string[];
  confidence: number;
  has_contradiction: boolean;
}

const DIRECTION_PATTERNS: Array<{ dir: InterventionDirection; re: RegExp }> = [
  { dir: "antagonist", re: /\b(?:antagonist|block(?:ing|er)?|inhibit(?:or|ion)?)\b/i },
  { dir: "agonist", re: /\b(?:agonist|activat(?:or|ion|e)|stimulat)\b/i },
  { dir: "modulator", re: /\bmodulat(?:or|ion)\b/i },
];

const CONTRADICTIONS: Record<
  InterventionDirection,
  RegExp[]
> = {
  antagonist: [
    /\b(?:agonist|activation|activating|protective effect of activation)\b/i,
    /\bactivation (?:is|may be) protective\b/i,
  ],
  agonist: [
    /\b(?:antagonist|inhibition|blocking|inhibitor)\b/i,
    /\binhibition (?:is|may be) protective\b/i,
  ],
  inhibitor: [
    /\bagonist\b/i,
    /\bactivation (?:is|may be) protective\b/i,
  ],
  modulator: [],
  unknown: [],
};

export function parseClaimedDirection(statement: string): InterventionDirection {
  for (const { dir, re } of DIRECTION_PATTERNS) {
    if (re.test(statement)) return dir;
  }
  return "unknown";
}

export function auditInterventionDirection(
  statement: string,
  cards: EvidenceCard[]
): DirectionAudit {
  const claimed = parseClaimedDirection(statement);
  const supporting: string[] = [];
  const contradicting: string[] = [];

  if (claimed === "unknown") {
    return {
      claimed_direction: claimed,
      supporting_evidence: [],
      contradicting_evidence: [],
      confidence: 0,
      has_contradiction: false,
    };
  }

  const contradictionRes = CONTRADICTIONS[claimed] ?? [];

  for (const card of cards) {
    if (card.is_challenge) continue;
    const excerpt = card.content.slice(0, 200);
    if (contradictionRes.some((re) => re.test(card.content))) {
      contradicting.push(excerpt);
    } else if (DIRECTION_PATTERNS.find((p) => p.dir === claimed)?.re.test(card.content)) {
      supporting.push(excerpt);
    }
  }

  const hasContradiction = contradicting.length > 0;
  const confidence =
    supporting.length === 0 && !hasContradiction
      ? 0.3
      : Math.min(
          1,
          Math.max(0.1, supporting.length / (supporting.length + contradicting.length + 1))
        );

  return {
    claimed_direction: claimed,
    supporting_evidence: supporting.slice(0, 3),
    contradicting_evidence: contradicting.slice(0, 3),
    confidence,
    has_contradiction: hasContradiction,
  };
}
