import type { HypothesisRecord, OpportunityObject } from "@/types/OpportunityObject";
import { callAgentJson } from "@/api/anthropic";
import { createHypothesis, getAllEvidenceCards, getOrgContext } from "@/lib/db";
import { getHypothesisInstruction } from "@/lib/domainContext";
import { sanitizeHypothesisFields } from "@/lib/scientificLanguage";
import { literatureAgent } from "@/agents/literatureAgent";
import { stage1LiteratureHypothesis } from "@/lib/hypothesisContext";

const CANDIDATE_HYPOTHESIS_SYSTEM = `You are the Literature Agent for Arclight Bio v2 candidate hypothesis generation.
Given PubMed literature and cross-domain signals, generate distinct falsifiable candidate hypotheses.
Return valid JSON only — an array of 5-10 hypothesis objects with keys:
statement, patient_population, unmet_need, org_positioning, first_in_class_claim, cross_domain_score (0-1), supporting_signal (short string).

Each hypothesis must be:
- Falsifiable with a specific mechanistic claim
- Distinct in mechanism or target from siblings
- Grounded in at least one cross-domain or high-quality literature signal
- First-in-class aware in first_in_class_claim`;

const OUTGROUP_SYSTEM = `You are selecting a calibration control hypothesis for a biomedical discovery system.
Given a user query and candidate novel hypotheses, generate ONE outgroup hypothesis representing a known-crowded, well-established field related to the query domain.
This is a negative control — it should represent saturated, heavily studied territory (many approved drugs and trials).
Return valid JSON with keys: statement, patient_population, unmet_need, org_positioning, crowded_field_rationale.`;

interface CandidateHypothesisPayload {
  statement: string;
  patient_population: string;
  unmet_need: string;
  org_positioning: string;
  first_in_class_claim?: string;
  cross_domain_score?: number;
  supporting_signal?: string;
}

interface OutgroupPayload {
  statement: string;
  patient_population: string;
  unmet_need: string;
  org_positioning: string;
  crowded_field_rationale?: string;
}

export async function literatureStage1Agent(
  obj: OpportunityObject
): Promise<HypothesisRecord[]> {
  const literatureObj =
    obj.search_query?.trim()
      ? {
          ...obj,
          hypothesis: stage1LiteratureHypothesis(obj.search_query),
        }
      : obj;
  await literatureAgent(literatureObj);

  const literatureCards = (await getAllEvidenceCards(obj.id))
    .filter(
      (c) =>
        !c.hypothesis_id &&
        !c.is_challenge &&
        c.contributing_agent === "literature"
    )
    .slice(0, 12);

  const literatureContext =
    literatureCards.length > 0
      ? `\n\nRetrieved literature (${literatureCards.length} relevant cards):\n${literatureCards
          .map((c, i) => `${i + 1}. ${c.content.slice(0, 220)}`)
          .join("\n")}`
      : "\n\nNo hypothesis-filtered PubMed cards were retrieved — assign conservative cross_domain_score values.";

  const org = await getOrgContext(obj.org_context_id);
  const query = obj.search_query ?? obj.hypothesis.statement;
  const domainInstruction = getHypothesisInstruction(obj.domain_context);
  const candidateCount = obj.mode === "depth" ? 10 : 5;

  let candidates: CandidateHypothesisPayload[] = [];
  let usedFallback = false;
  try {
    candidates = await callAgentJson<CandidateHypothesisPayload[]>(
      CANDIDATE_HYPOTHESIS_SYSTEM,
      `Search query: "${query}"
Domain context: ${obj.domain_context ?? "general"}
${domainInstruction ? `Domain instruction: ${domainInstruction}` : ""}
Organization: ${org?.org_name ?? "Unknown"}
${literatureContext}

Generate ${candidateCount} distinct candidate hypotheses grounded in the literature signals above.
Rank cross_domain_score higher when cross-domain mechanistic bridges are strong.
Include first_in_class_claim for each.`
    );
    if (!Array.isArray(candidates)) candidates = [];
  } catch {
    candidates = [];
    usedFallback = true;
  }

  if (candidates.length === 0) {
    usedFallback = true;
    candidates = [
      {
        statement: `Mechanistic opportunity in ${query}: pathway modulation may address unmet need pending validation.`,
        patient_population: `Patients with ${query}-relevant indications`,
        unmet_need: `Evidence suggests residual unmet need in ${query}`,
        org_positioning: org
          ? `${org.org_name} may explore aligned therapeutic areas.`
          : "Portfolio alignment pending.",
        cross_domain_score: 0.35,
        first_in_class_claim: "Novelty requires validation against prior art.",
      },
    ];
  }

  candidates.sort(
    (a, b) => (b.cross_domain_score ?? 0) - (a.cross_domain_score ?? 0)
  );

  const stored: HypothesisRecord[] = [];
  for (let i = 0; i < Math.min(candidates.length, candidateCount); i++) {
    const c = candidates[i];
    const sanitized = sanitizeHypothesisFields({
      statement: c.statement,
      patient_population: c.patient_population,
      unmet_need: c.unmet_need,
      org_positioning: c.org_positioning,
      source: usedFallback ? "fallback" : "llm",
    });
    const record = await createHypothesis(obj.id, {
      rank: i + 1,
      is_outgroup: false,
      ...sanitized,
      cross_domain_score: c.cross_domain_score ?? 0.5,
    });
    stored.push(record);
  }

  let outgroup: OutgroupPayload;
  let outgroupFromFallback = false;
  try {
    outgroup = await callAgentJson<OutgroupPayload>(
      OUTGROUP_SYSTEM,
      `Query: "${query}"
Domain: ${obj.domain_context ?? "general"}
Novel candidates (avoid duplicating these mechanisms):
${stored.map((h) => `- ${h.statement}`).join("\n")}

Select a known crowded, well-established comparator field as the outgroup calibration control.`
    );
  } catch {
    outgroupFromFallback = true;
    outgroup = {
      statement: `[Calibration control — crowded field] Established standard-of-care landscape for ${query.split(" ").slice(0, 3).join(" ")} with extensive prior art.`,
      patient_population: `Broad patient population in a mature, heavily studied indication adjacent to: ${query}`,
      unmet_need: `Incremental improvements in a saturated market — high competition, established therapies.`,
      org_positioning: "Calibration control — not a novel discovery target.",
      crowded_field_rationale: "Auto-generated saturated-field comparator.",
    };
  }

  const outgroupSanitized = sanitizeHypothesisFields({
    statement: outgroup.statement.startsWith("[Calibration")
      ? outgroup.statement
      : `[Calibration control — crowded field] ${outgroup.statement}`,
    patient_population: outgroup.patient_population,
    unmet_need: outgroup.unmet_need,
    org_positioning: outgroup.org_positioning,
    source: outgroupFromFallback ? "fallback" : "outgroup",
  });

  const outgroupRecord = await createHypothesis(obj.id, {
    rank: stored.length + 1,
    is_outgroup: true,
    ...outgroupSanitized,
    cross_domain_score: 0.1,
  });
  stored.push(outgroupRecord);

  return stored;
}
