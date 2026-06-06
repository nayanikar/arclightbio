import { callAgentJson } from "@/api/anthropic";
import type { OpportunityObject } from "@/types/OpportunityObject";
import type { AnchorProfiles } from "@/types/V3Pipeline";
import { updateOpportunityObject } from "@/lib/db";
import { updateV3OpportunityFields } from "@/lib/v3Db";
import { sanitizeScientificClaim } from "@/lib/scientificLanguage";
import { funnelAgentConfig } from "@/lib/innovationProfile";
import {
  buildPhase1PromptHeader,
  formatCohortBlock,
  JSON_ONLY_SUFFIX,
  loadPhase1Context,
  resolveCohort,
} from "./shared";

const SYSTEM = `You are the Anchor Population Agent for Arclight Bio V3 Phase 1.
Define two high-ROI anchor populations per the SME spec:
1. Biology anchor — core disease biology driving the program
2. Resistance anchor — treatment failure / resistance context motivating the query

Each anchor needs a falsifiable anchor_statement (subject–relationship–outcome).
Also synthesize program_hypothesis_sentence linking query + parent domain + cohort.

SME rules for program_hypothesis_sentence:
- Anchor on the defining population criterion from the user query (e.g. absence of dominant oncogenic driver), NOT on a specific mutation class or mechanism.
- Cohort biomarkers mentioning loss-of-function (LOF) are supporting context only — do NOT elevate LOF, synthetic-lethal, or tumor-suppressor language to the program thesis unless the query explicitly requires LOF as the primary thesis.
- Biology and resistance anchor_statement values must be falsifiable subject–relationship–outcome sentences tied to population + resistance context, not mechanism-first LOF claims.

Return JSON:
{
  "program_hypothesis_sentence": string,
  "anchor_profiles": {
    "biology": { "population": string, "rationale": string, "anchor_statement": string },
    "resistance": { "population": string, "rationale": string, "anchor_statement": string }
  }
}${JSON_ONLY_SUFFIX}`;

interface AnchorPayload {
  program_hypothesis_sentence: string;
  anchor_profiles: AnchorProfiles;
}

export async function anchorPopulationAgent(obj: OpportunityObject): Promise<{
  anchor_profiles: AnchorProfiles;
  program_hypothesis_sentence: string;
}> {
  const ctx = await loadPhase1Context(obj);
  const cohort = await resolveCohort(ctx);
  const population = ctx.population_definition?.definition ?? ctx.hypothesis.patient_population;

  const funnel = funnelAgentConfig(ctx, "generate");
  let payload: AnchorPayload;
  try {
    payload = await callAgentJson<AnchorPayload>(
      `${SYSTEM}\n\n${funnel.systemAddon}`,
      `${buildPhase1PromptHeader(ctx)}
Defined population: ${population}
Unmet need: ${ctx.population_definition?.unmet_need ?? ctx.hypothesis.unmet_need}

${formatCohortBlock(cohort)}

Resistance anchor must reflect non-responder / refractory patterns in cohort when present.

Program hypothesis must reflect the query-defined population as primary; treat LOF biomarkers in cohort as optional context, not the program thesis.`,
      { temperature: funnel.temperature }
    );
  } catch {
    const domain = ctx.parent_domain ?? "the selected";
    payload = {
      program_hypothesis_sentence: `The defined patient population in ${domain} exhibits a modifiable biology–resistance axis that motivates a targeted therapeutic program, independent of any single mutation class.`,
      anchor_profiles: {
        biology: {
          population: population,
          market_size: "TBD",
          rationale: "Core disease biology driving pathophysiology in the defined cohort.",
          anchor_statement: `Disease biology in ${population} is associated with the phenotype motivating this program.`,
        },
        resistance: {
          population: `Treatment-refractory subset of ${population}`,
          market_size: "TBD",
          rationale: "Resistance / non-response defines the commercial and clinical urgency.",
          anchor_statement: `Resistance to standard therapy in ${population} is associated with an actionable mechanistic axis.`,
        },
      },
    };
  }

  const anchor_profiles: AnchorProfiles = {
    biology: {
      ...payload.anchor_profiles.biology,
      anchor_statement: sanitizeScientificClaim(payload.anchor_profiles.biology.anchor_statement),
      population: sanitizeScientificClaim(payload.anchor_profiles.biology.population),
      rationale: sanitizeScientificClaim(payload.anchor_profiles.biology.rationale),
    },
    resistance: {
      ...payload.anchor_profiles.resistance,
      anchor_statement: sanitizeScientificClaim(payload.anchor_profiles.resistance.anchor_statement),
      population: sanitizeScientificClaim(payload.anchor_profiles.resistance.population),
      rationale: sanitizeScientificClaim(payload.anchor_profiles.resistance.rationale),
    },
  };

  const program_hypothesis_sentence = sanitizeScientificClaim(
    payload.program_hypothesis_sentence
  );

  await updateV3OpportunityFields(ctx.id, {
    anchor_profiles,
    program_hypothesis_sentence,
    v3_phase: "phase1:anchors",
  });
  await updateOpportunityObject(ctx.id, {
    hypothesis: {
      ...ctx.hypothesis,
      statement: program_hypothesis_sentence,
      patient_population: population,
    },
  });

  return { anchor_profiles, program_hypothesis_sentence };
}
