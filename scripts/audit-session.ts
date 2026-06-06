import { getOpportunityObject } from "../src/lib/db";
import { isBlackboardV2Complete } from "../src/lib/blackboardRunV2";

const id = process.argv[2] ?? "59755741-cb24-44a9-8d20-ef88a4192d18";

async function main() {
  const obj = await getOpportunityObject(id);
  if (!obj) {
    console.log("NOT FOUND");
    return;
  }

  const steps = obj.blackboard_state?.completedSteps ?? [];
  console.log("=== SESSION", id.slice(0, 8), "===");
  console.log("status:", obj.status);
  console.log("pipeline_complete:", isBlackboardV2Complete(obj.blackboard_state));
  console.log("steps:", steps.length);
  console.log("top_hypothesis_id:", obj.top_hypothesis_id);
  console.log("root scores:", obj.confidence_score, obj.actionability_zone);
  console.log("outgroup:", JSON.stringify(obj.outgroup_validation));

  const brief = obj.decision_brief;
  console.log("\n=== DECISION BRIEF ===");
  if (!brief) {
    console.log("MISSING");
  } else {
    console.log("recommendation:", brief.recommendation);
    console.log("rationale:", brief.recommendation_rationale);
    console.log("calibration_caveat:", brief.calibration_caveat ?? "(none)");
    console.log("portfolio_fit:", brief.portfolio_fit.summary);
    console.log("TPP min:", brief.tpp.minimum.slice(0, 120));
    console.log("TPP base:", brief.tpp.base.slice(0, 120));
    console.log("TPP aspirational:", brief.tpp.aspirational.slice(0, 120));
    console.log("differentiation:", brief.differentiation.slice(0, 200));
    console.log("risks:", brief.critical_risks.length);
    brief.critical_risks.forEach((r, i) =>
      console.log(`  risk ${i + 1} [${r.severity}]:`, r.risk.slice(0, 100), "cards:", r.evidence_card_ids.length)
    );
    console.log("derisk_plan:", brief.derisk_plan.length);
    brief.derisk_plan.forEach((d, i) =>
      console.log(`  ${i + 1}.`, d.study_type, "N=", d.n_required)
    );
    console.log("next_proof:", brief.next_proof_point.study_type, "N=", brief.next_proof_point.n_required);
    console.log("evidence_card_ids:", brief.evidence_card_ids.length);
    console.log("ranking_summary:", brief.hypothesis_ranking_summary.slice(0, 250));
  }

  const hyps = obj.hypotheses ?? [];
  console.log("\n=== HYPOTHESES ===");
  for (const h of [...hyps].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))) {
    console.log(
      `#${h.rank} ${h.is_outgroup ? "[OG]" : ""} conf=${h.confidence_score?.toFixed(4)} zone=${h.actionability_zone} cards=${h.evidence_cards?.length ?? 0} ch=${h.challenges?.length ?? 0}`
    );
    console.log(" ", h.statement.slice(0, 90));
    if (h.target_alignment) {
      console.log("  target_alignment:", h.target_alignment.status, h.target_alignment.message.slice(0, 80));
    }
    if (h.mechanistic_chain) {
      console.log(
        "  mechanistic_chain:",
        h.mechanistic_chain.overall_chain_confidence,
        "edges:",
        h.mechanistic_chain.edges.length,
        "gaps:",
        h.mechanistic_chain.gaps.length
      );
    }
    if (h.score_decomposition) {
      console.log("  score_interp:", h.score_decomposition.interpretation.slice(0, 100));
    }
  }

  console.log("\n=== WAVE 5 RUBRIC ===");
  const top = hyps.find((h) => h.id === obj.top_hypothesis_id);
  console.log("target_aligned:", top?.target_alignment?.status === "aligned" ? "PASS" : top?.target_alignment ? "FAIL/MISMATCH" : "MISSING (re-run pipeline)");
  console.log("mechanistic_chain:", top?.mechanistic_chain?.edges.length ? "PASS" : "MISSING (re-run pipeline)");
  console.log("score_interpretation:", brief?.score_interpretation ? "PASS" : "MISSING");
  console.log("biomarkers:", brief?.recommended_biomarkers?.efficacy?.length ? "PASS" : "MISSING");
  console.log("disease_models:", brief?.recommended_models?.length ? "PASS" : "MISSING");
  console.log("direction_audit:", brief?.interventional_direction ? "PASS" : "MISSING");

  const recon = (obj.evidence_cards ?? []).filter(
    (c) => c.raw_source_metadata?.reconciliation
  );
  console.log("\nreconciliation cards:", recon.length);

  const og = hyps.find((h) => h.is_outgroup);
  const novel = hyps.filter((h) => !h.is_outgroup && h.confidence_score != null);
  if (og) {
    console.log(
      "outgroup challenges:",
      og.challenges?.length,
      "conf:",
      og.confidence_score
    );
  }
  console.log(
    "novel median conf:",
    novel.length
      ? (
          novel.reduce((s, h) => s + (h.confidence_score ?? 0), 0) / novel.length
        ).toFixed(4)
      : "n/a"
  );
}

main().catch(console.error);
