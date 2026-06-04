import type {
  ActionabilityZone,
  AgentName,
  EvidenceCard,
  OpportunityObject,
} from "@/types/OpportunityObject";

export const AGENT_PIP_COLORS: Record<AgentName, string> = {
  literature: "#534AB7",
  mechanism: "#1D9E75",
  clinical_trial: "#378ADD",
  regulatory: "#D85A30",
  commercial: "#BA7517",
  rwe_signal: "#639922",
  modality: "#8B5CF6",
};

export interface DashboardMetrics {
  active: number;
  actNow: number;
  tooEarly: number;
  avgConfidence: number;
}

export interface DashboardSlots {
  featured: OpportunityObject | null;
  secondaryLeft: OpportunityObject | null;
  secondaryRight: OpportunityObject | null;
  remaining: OpportunityObject[];
}

export function filterDashboardOpportunities(
  opportunities: OpportunityObject[]
): OpportunityObject[] {
  return opportunities.filter((o) => o.status !== "archived");
}

export function sortByConfidenceDesc(
  opportunities: OpportunityObject[]
): OpportunityObject[] {
  return [...opportunities].sort(
    (a, b) => b.confidence_score - a.confidence_score
  );
}

export function computeDashboardMetrics(
  opportunities: OpportunityObject[]
): DashboardMetrics {
  const active = opportunities.length;
  const actNow = opportunities.filter(
    (o) => o.actionability_zone === "act_now"
  ).length;
  const tooEarly = opportunities.filter(
    (o) => o.actionability_zone === "too_early"
  ).length;
  const avgConfidence =
    active > 0
      ? Math.round(
          (opportunities.reduce((sum, o) => sum + o.confidence_score, 0) /
            active) *
            100
        )
      : 0;

  return { active, actNow, tooEarly, avgConfidence };
}

export function selectDashboardSlots(
  opportunities: OpportunityObject[]
): DashboardSlots {
  const sorted = sortByConfidenceDesc(opportunities);

  const featured =
    sorted.find((o) => o.actionability_zone === "act_now") ??
    sorted[0] ??
    null;

  const rest = featured
    ? sorted.filter((o) => o.id !== featured.id)
    : sorted;

  const secondaryLeft = sorted.length >= 2 ? (rest[0] ?? null) : null;
  const secondaryRight = sorted.length >= 3 ? (rest[1] ?? null) : null;
  const remaining = sorted.length >= 4 ? rest.slice(2) : [];

  return { featured, secondaryLeft, secondaryRight, remaining };
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

export function formatUserQuery(query: string | undefined): string {
  if (!query?.trim()) return "Untitled discovery";

  const segments = query
    .split(/\s+(?:and|for|in|with|×|x)\s+|\s*,\s*|\s+×\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);

  if (segments.length <= 1) {
    const words = query.trim().split(/\s+/);
    if (words.length >= 4) {
      const mid = Math.ceil(words.length / 2);
      const left = words.slice(0, mid).join(" ");
      const right = words.slice(mid).join(" ");
      return `${capitalizeFirst(left)} × ${right}`;
    }
    return capitalizeFirst(query.trim());
  }

  const [first, ...rest] = segments;
  return [capitalizeFirst(first), ...rest].join(" × ");
}

function capitalizeFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function firstSentence(text: string, max = 120): string {
  const match = text.match(/^[^.!?]+[.!?]?/);
  const sentence = (match?.[0] ?? text).trim();
  return truncate(sentence, max);
}

export function firstNWords(text: string, n: number): string {
  return text.trim().split(/\s+/).slice(0, n).join(" ");
}

export function getUniqueAgents(cards: EvidenceCard[]): AgentName[] {
  const seen = new Set<AgentName>();
  const agents: AgentName[] = [];
  for (const card of cards) {
    if (!seen.has(card.contributing_agent)) {
      seen.add(card.contributing_agent);
      agents.push(card.contributing_agent);
    }
  }
  return agents;
}

export function getRecentSurveillanceAgents(
  opp: OpportunityObject,
  withinMs = 10 * 60 * 1000
): AgentName[] {
  const lastEntry = opp.change_log[opp.change_log.length - 1];
  if (!lastEntry) return [];

  const elapsed = Date.now() - new Date(lastEntry.timestamp).getTime();
  if (elapsed > withinMs) return [];

  return lastEntry.agents_reinitiated ?? [];
}

export function getLastScanMinutesAgo(
  opportunities: OpportunityObject[]
): number | null {
  let latest: number | null = null;

  for (const opp of opportunities) {
    const lastEntry = opp.change_log[opp.change_log.length - 1];
    if (!lastEntry) continue;
    const ts = new Date(lastEntry.timestamp).getTime();
    if (latest === null || ts > latest) latest = ts;
  }

  if (latest === null) return null;
  return Math.max(0, Math.floor((Date.now() - latest) / 60_000));
}

export function confidenceBarColor(
  score: number,
  zone?: ActionabilityZone
): string {
  if (zone === "crowded") return "#BA7517";
  if (zone === "act_now") return "#1D9E75";
  if (zone === "too_early") return "#D85A30";
  if (score >= 0.75) return "#BA7517";
  if (score >= 0.3) return "#1D9E75";
  return "#D85A30";
}

export function zoneAccentColor(zone: ActionabilityZone): string {
  return confidenceBarColor(0, zone);
}

export function formatUpdatedAgoShort(lastUpdated: string): string {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(lastUpdated).getTime()) / 60_000)
  );
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 min ago";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return "1 hour ago";
  return `${hours} hours ago`;
}
