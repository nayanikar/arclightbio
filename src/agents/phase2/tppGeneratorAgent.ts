import type { HypothesisRecord, OpportunityObject } from "@/types/OpportunityObject";
import type { TppBlueprint } from "@/types/V3Pipeline";
import { callAgentJson } from "@/api/anthropic";
import { buildCompetitiveLandscape } from "@/lib/competitiveLandscape";
import { getAllEvidenceCards } from "@/lib/db";
import { upsertDrugDiscoveryAssessment } from "@/lib/v3Db";
import { discoverySystemPrompt, narrativeTemperature } from "@/lib/innovationProfile";
import { buildPhase2Context, contextPrompt, loadAssessment } from "./helpers";

const SYSTEM = `You are a TPP (Target Product Profile) architect for first-in-class drug development.
Produce an indication-scoped competitive landscape. Define first-in-class by MECHANISM, not generic target label.
Categorize biomarkers into exactly 4 arrays: predictive, target_engagement_pd, safety, surrogate.
Use falsifiable subject-relationship-outcome sentences for product claims.
Return valid JSON matching TppBlueprint schema with all required fields.`;

export async function tppGeneratorAgent(
  obj: OpportunityObject,
  hypothesis: HypothesisRecord
): Promise<void> {
  const ctx = buildPhase2Context(obj, hypothesis);
  const assessment = await loadAssessment(obj.id, hypothesis.id);
  const cards = await getAllEvidenceCards(obj.id);

  let competitive = {
    approved: [] as string[],
    active_trials: [] as string[],
    failed_programs: [] as string[],
  };
  try {
    const landscape = await buildCompetitiveLandscape(
      ctx.primaryTarget,
      ctx.indicationScope,
      cards
    );
    competitive = {
      approved: landscape.approved ?? [],
      active_trials: landscape.active ?? [],
      failed_programs: landscape.failed ?? [],
    };
  } catch {
    // non-fatal
  }

  let tpp: TppBlueprint;
  try {
    tpp = await callAgentJson<TppBlueprint>(
      discoverySystemPrompt(SYSTEM, obj),
      `${contextPrompt(ctx)}
Modality: ${assessment.selected_modality ?? "TBD"}
Druggability: ${assessment.druggability_score ?? "not scored"}
Competitive landscape — approved: ${competitive.approved.join("; ") || "none"}
Active trials: ${competitive.active_trials.slice(0, 5).join("; ") || "none"}
Failed: ${competitive.failed_programs.slice(0, 3).join("; ") || "none"}
Dropped links: ${JSON.stringify(hypothesis.dropped_links ?? [])}`,
      { temperature: narrativeTemperature(obj) }
    );
  } catch {
    tpp = {
      product_characteristics: `First-in-class ${assessment.selected_modality ?? "therapeutic"} modulating ${ctx.primaryTarget} for ${ctx.indicationScope}.`,
      tissue_delivery: "To be defined based on target tissue distribution.",
      evidence_collection_plan:
        "Preclinical PD biomarkers → Phase 1b expansion cohort with target engagement.",
      falsifiable_product_claim: `${ctx.primaryTarget} modulation will improve clinical outcome in ${ctx.indicationScope} patients with biomarker-defined enrichment.`,
      anchor_link_preserved: Boolean(hypothesis.anchor_linkage),
      lost_link_flag: (hypothesis.dropped_links?.length ?? 0) > 0,
      indication_scope: ctx.indicationScope,
      competitive_positioning_vs_soc:
        competitive.approved.length > 0
          ? `Differentiate from SOC: ${competitive.approved.slice(0, 3).join(", ")}`
          : "No direct SOC competitors identified for this mechanism in indication.",
      clinician_patient_choice_rationale:
        "Offer mechanism-distinct option for patients failing current SOC.",
      first_in_class_mechanism_claim: `No approved agent with ${ctx.primaryTarget}-selective mechanism in ${ctx.indicationScope}.`,
      biomarkers: {
        predictive: ["Baseline biomarker panel TBD"],
        target_engagement_pd: [`${ctx.primaryTarget} pathway suppression marker`],
        safety: ["Standard safety labs + target-class monitoring"],
        surrogate: ["Early pharmacodynamic response at Week 4"],
      },
      product_assumptions: [
        "Target is selectively druggable",
        "Biomarker enrichment improves effect size",
      ],
    };
  }

  await upsertDrugDiscoveryAssessment(obj.id, hypothesis.id, {
    tpp_blueprint: tpp,
  });
}
