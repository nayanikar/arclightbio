import type { HypothesisRecord, OpportunityObject } from "@/types/OpportunityObject";
import { callAgentJson } from "@/api/anthropic";
import { searchFDAApprovals } from "@/api/openFda";
import { searchTrialsByTerm } from "@/api/clinicalTrials";
import { buildPhase2Context, contextPrompt, mergeAssessment } from "./helpers";
import { getActiveTrailCapture } from "@/lib/trailCapture";

const SYSTEM = `You are a drug discovery analyst checking whether an approved or late-stage therapy already addresses the proposed mechanism for the indication.
Before claiming first-in-class, verify in-clinic therapies for the indication.
Return valid JSON only:
{
  "drug_exists": boolean,
  "branch": "existing" | "new",
  "existing_drug_name": string | null,
  "existing_drug_mechanism": string | null,
  "in_clinic_for_indication": boolean,
  "rationale": string
}`;

export async function existingDrugCheckerAgent(
  obj: OpportunityObject,
  hypothesis: HypothesisRecord
): Promise<void> {
  const ctx = buildPhase2Context(obj, hypothesis);
  let fdaApprovals: string[] = [];
  let activeTrials: string[] = [];

  const trail = getActiveTrailCapture();
  try {
    const fda = await searchFDAApprovals(ctx.primaryTarget, ctx.indicationScope, 8);
    fdaApprovals = fda.map(
      (d) => `${d.brandName ?? d.genericName} (${d.genericName || d.manufacturer || "unknown MoA"})`
    );
    for (const d of fda.slice(0, 5)) {
      trail?.addSource({
        label: d.brandName ?? d.genericName ?? "FDA approval",
        url: "https://api.fda.gov/drug/drugsfda.json",
        type: "fda",
        excerpt: `${d.genericName ?? ""} ${d.manufacturer ?? ""}`.trim(),
      });
    }
  } catch {
    // non-fatal
  }

  try {
    const trials = await searchTrialsByTerm(
      `${ctx.primaryTarget} ${ctx.indicationScope}`,
      10,
      false
    );
    activeTrials = trials
      .filter((t) => /RECRUITING|ACTIVE|PHASE\s*3/i.test(t.status))
      .map((t) => t.title.slice(0, 100));
    for (const t of trials.slice(0, 5)) {
      trail?.addSource({
        label: t.nctId,
        url: `https://clinicaltrials.gov/study/${t.nctId}`,
        type: "clinicaltrials",
        excerpt: t.title,
      });
    }
  } catch {
    // non-fatal
  }

  let result: {
    drug_exists: boolean;
    branch: "existing" | "new";
    existing_drug_name?: string | null;
    existing_drug_mechanism?: string | null;
    in_clinic_for_indication?: boolean;
    rationale?: string;
  };

  try {
    result = await callAgentJson(
      SYSTEM,
      `${contextPrompt(ctx)}

FDA approvals for target/indication: ${fdaApprovals.join("; ") || "none found"}
Active late-stage trials: ${activeTrials.join("; ") || "none found"}`
    );
  } catch {
    const exists = fdaApprovals.length > 0 || activeTrials.length > 0;
    result = {
      drug_exists: exists,
      branch: exists ? "existing" : "new",
      existing_drug_name: fdaApprovals[0] ?? null,
      in_clinic_for_indication: fdaApprovals.length > 0,
      rationale: exists
        ? "Therapies with related mechanism found in clinic or late-stage trials."
        : "No matching approved or late-stage therapy identified.",
    };
  }

  trail?.setSummary(result.rationale ?? "Drug landscape check complete.");

  await mergeAssessment(obj.id, hypothesis.id, {
    drug_exists: result.drug_exists,
    branch: result.branch,
    existing_drug_name: result.existing_drug_name ?? undefined,
    existing_drug_mechanism: result.existing_drug_mechanism ?? undefined,
    in_clinic_for_indication: result.in_clinic_for_indication ?? false,
  });
}
