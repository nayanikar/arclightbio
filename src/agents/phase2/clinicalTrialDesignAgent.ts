import type { HypothesisRecord, OpportunityObject } from "@/types/OpportunityObject";
import type { ClinicalDevelopmentPlan } from "@/types/V3Pipeline";
import { callAgentJson } from "@/api/anthropic";
import { getDrugDiscoveryAssessment, getIndRegulatoryPackage, upsertIndRegulatoryPackage } from "@/lib/v3Db";
import { buildPhase2Context, contextPrompt, loadAssessment } from "./helpers";

const SYSTEM = `You are a clinical development strategist designing a Clinical Development Plan (CDP) for IND.
Biomarkers MUST be categorized into 4 arrays: predictive, target_engagement_pd, safety, surrogate.
Return valid JSON for clinical_development_plan with: trial_type, design, sample_size, inclusion_criteria, exclusion_criteria, biomarkers (4 categories), primary_endpoint, secondary_endpoints.`;

export async function clinicalTrialDesignAgent(
  obj: OpportunityObject,
  hypothesis: HypothesisRecord
): Promise<void> {
  const ctx = buildPhase2Context(obj, hypothesis);
  const assessment = await loadAssessment(obj.id, hypothesis.id);
  const drugRecord = await getDrugDiscoveryAssessment(obj.id, hypothesis.id);
  const existing = await getIndRegulatoryPackage(obj.id, hypothesis.id);
  const tppBiomarkers = drugRecord?.tpp_blueprint?.biomarkers;

  let cdp: ClinicalDevelopmentPlan;
  try {
    cdp = await callAgentJson<ClinicalDevelopmentPlan>(
      SYSTEM,
      `${contextPrompt(ctx)}
Modality: ${assessment.selected_modality ?? "TBD"}
TPP biomarkers: ${JSON.stringify(tppBiomarkers ?? {})}`
    );
  } catch {
    cdp = {
      trial_type: "Phase 1b/2 adaptive",
      design: "Open-label biomarker-enriched expansion with randomized SOC comparison",
      sample_size: 120,
      inclusion_criteria: [
        `Confirmed ${ctx.indicationScope}`,
        "Biomarker-positive per predictive panel",
        "Adequate organ function",
      ],
      exclusion_criteria: [
        "Active uncontrolled infection",
        "Prior therapy conflicting with mechanism",
      ],
      biomarkers: tppBiomarkers ?? {
        predictive: ["Enrichment biomarker TBD"],
        target_engagement_pd: [`${ctx.primaryTarget} pathway modulation`],
        safety: ["Hepatic/renal monitoring panel"],
        surrogate: ["Early tumor/response marker at 8 weeks"],
      },
      primary_endpoint: "Objective response rate at 24 weeks",
      secondary_endpoints: [
        "Progression-free survival",
        "Duration of response",
        "Safety and tolerability",
      ],
    };
  }

  await upsertIndRegulatoryPackage(obj.id, hypothesis.id, {
    package: {
      ...(existing?.package ?? {}),
      clinical_development_plan: cdp,
    },
  });
}
