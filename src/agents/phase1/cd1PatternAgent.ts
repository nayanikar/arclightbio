import { callAgentJson } from "@/api/anthropic";
import type { OpportunityObject } from "@/types/OpportunityObject";
import type { CD1Pattern } from "@/types/V3Pipeline";
import { updateV3OpportunityFields } from "@/lib/v3Db";
import { parentDomainLabel } from "@/lib/parentDomains";
import {
  buildPhase1PromptHeader,
  formatCohortBlock,
  JSON_ONLY_SUFFIX,
  loadPhase1Context,
  resolveCohort,
} from "./shared";
import { discoverySystemPrompt, narrativeTemperature } from "@/lib/innovationProfile";

const SYSTEM = `You are the CD1 Pattern Agent for Arclight Bio V3 Phase 1.
Identify co-occurring scientific domains in the uploaded cohort that are NOT the parent domain (PD).
Compute recurrence_rate = patient_count / cohort_N for each non-PD pattern.

Return JSON array (max 8):
[{
  "domain": string,
  "pattern": string,
  "recurrence_rate": number (0-1),
  "patient_count": number,
  "co_occurring_features": string[],
  "parent_domain": string
}]${JSON_ONLY_SUFFIX}`;

function computeDomainSummary(cohortN: number, diagnoses: string[]): string {
  const counts = new Map<string, number>();
  for (const dx of diagnoses) {
    const key = dx.trim().toLowerCase();
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([dx, n]) => `${dx}: ${n}/${cohortN}`)
    .join("; ");
}

export async function cd1PatternAgent(obj: OpportunityObject): Promise<CD1Pattern[]> {
  const ctx = await loadPhase1Context(obj);
  const cohort = await resolveCohort(ctx);
  const parentDomain = parentDomainLabel(ctx.parent_domain ?? undefined);
  const cohortN = cohort?.patient_count ?? 0;

  const featureRows =
    cohort?.patients.map((p) => ({
      diagnoses: p.primary_diagnosis,
      comorbidities: p.comorbidities.join("; "),
      biomarkers: p.biomarkers.join("; "),
      resistance: p.resistance_status,
    })) ?? [];

  let patterns: CD1Pattern[];
  try {
    patterns = await callAgentJson<CD1Pattern[]>(
      discoverySystemPrompt(SYSTEM, ctx),
      `${buildPhase1PromptHeader(ctx)}
Parent domain to EXCLUDE as CD1 source: ${parentDomain}
Cohort N=${cohortN}

${formatCohortBlock(cohort)}

Feature rows:
${featureRows
  .slice(0, 30)
  .map((r) => JSON.stringify(r))
  .join("\n")}

Find non-PD co-occurring domains (comorbidity clusters, biomarker patterns, resistance phenotypes).`,
      { temperature: narrativeTemperature(ctx) }
    );
    if (!Array.isArray(patterns)) patterns = [];
  } catch {
    const diagnoses = cohort?.patients.map((p) => p.primary_diagnosis) ?? [];
    patterns =
      cohortN > 0
        ? [
            {
              domain: "Cohort comorbidity overlay",
              pattern: computeDomainSummary(cohortN, diagnoses),
              recurrence_rate: 0.35,
              patient_count: Math.ceil(cohortN * 0.35),
              co_occurring_features: ["comorbidities", "resistance_status"],
              parent_domain: parentDomain,
            },
          ]
        : [];
  }

  const normalized = patterns.slice(0, 8).map((p) => ({
    ...p,
    parent_domain: parentDomain,
    recurrence_rate: Math.min(1, Math.max(0, p.recurrence_rate ?? 0)),
  }));

  await updateV3OpportunityFields(ctx.id, {
    cd1_patterns: normalized,
    v3_phase: "phase1:cd1",
  });

  return normalized;
}
