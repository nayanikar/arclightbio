import type { OpportunityObject } from "@/types/OpportunityObject";
import { getAdverseEvents } from "@/api/openFda";
import { searchTrials } from "@/api/clinicalTrials";
import { insertEvidenceCard } from "@/lib/db";
import { computeCompositeQuality } from "@/lib/scoring";
import { ApiError } from "@/lib/http";
import { resolveAgentKeywords, resolveAgentQuery } from "@/lib/hypothesisContext";

export async function rweSignalAgent(obj: OpportunityObject): Promise<void> {
  const { conditions, interventions } = resolveAgentKeywords(obj);
  const query = resolveAgentQuery(obj);
  const drugTerm =
    interventions[0] ??
    conditions[0] ??
    query.split(/\s+/).slice(0, 3).join(" ") ??
    "";

  let events: Awaited<ReturnType<typeof getAdverseEvents>> = [];
  let trials: Awaited<ReturnType<typeof searchTrials>> = [];
  let partial = false;

  try {
    events = await getAdverseEvents(drugTerm, 100);
  } catch (err) {
    partial = true;
    if (!(err instanceof ApiError)) throw err;
  }

  try {
    trials = await searchTrials(conditions.join(" "), drugTerm, 10);
  } catch {
    partial = true;
  }

  const totalReports = events.reduce((sum, e) => sum + e.count, 0);
  const topReactions = events.slice(0, 5).map((e) => `${e.reaction} (${e.count})`);
  const offLabelIndications = events
    .filter((e) => e.indication)
    .reduce(
      (acc, e) => {
        const key = e.indication!.toLowerCase();
        acc[key] = (acc[key] ?? 0) + e.count;
        return acc;
      },
      {} as Record<string, number>
    );

  const offLabelEntries = Object.entries(offLabelIndications)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const totalEnrollment = trials.reduce((sum, t) => sum + t.enrollment, 0);

  const content = `Real-world signal analysis for ${drugTerm || query.slice(0, 80)}: ${totalReports} FAERS reports across ${events.length} reaction types. ${
    offLabelEntries.length > 0
      ? `Off-label indications detected: ${offLabelEntries.map(([ind, c]) => `${ind} (${c} reports)`).join("; ")}.`
      : "No strong off-label indication signals detected."
  } Clinical trial enrollment total: ${totalEnrollment} patients across ${trials.length} trials.`;

  const quality = {
    sample_size: Math.min(1, totalReports / 500),
    study_design: 0.5,
    source_credibility: 0.7,
    replication: events.length > 5 ? 0.6 : 0.4,
    recency: 0.75,
  };

  await insertEvidenceCard(obj.id, {
    content: content + (partial ? " [Partial search]" : ""),
    source_url: `https://api.fda.gov/drug/event.json?search=patient.drug.medicinalproduct:${encodeURIComponent(drugTerm)}`,
    source_type: "rwe",
    contributing_agent: "rwe_signal",
    quality_scores: { ...quality, composite: computeCompositeQuality(quality) },
    regulatory_weight: computeCompositeQuality(quality),
    raw_source_metadata: {
      drugTerm,
      totalReports,
      topReactions,
      offLabelIndications: offLabelEntries,
      trials: trials.slice(0, 5),
      totalEnrollment,
      partial,
    },
  });
}
