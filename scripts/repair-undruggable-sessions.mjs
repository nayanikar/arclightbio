#!/usr/bin/env node
/**
 * Repair V3 sessions where primary target is undruggable but drug branch still has scores.
 * Usage: node scripts/repair-undruggable-sessions.mjs [--dry-run] [--id=<uuid>]
 */
import { createClient } from "@supabase/supabase-js";

const dryRun = process.argv.includes("--dry-run");
const idArg = process.argv.find((a) => a.startsWith("--id="));
const filterId = idArg?.slice("--id=".length);

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    "Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: {
    transport: class NoopWebSocket {
      constructor() {
        this.readyState = 1;
      }
      send() {}
      close() {}
      addEventListener() {}
      removeEventListener() {}
    },
  },
});

function targetMatches(a, b) {
  const na = (a ?? "").toLowerCase().trim();
  const nb = (b ?? "").toLowerCase().trim();
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

function isTargetUndraggable(targetName, registry) {
  const needle = (targetName ?? "").toLowerCase().trim();
  if (!needle) return false;
  return registry.some(
    (entry) =>
      entry.target_name.toLowerCase() === needle ||
      needle.includes(entry.target_name.toLowerCase()) ||
      entry.target_name.toLowerCase().includes(needle)
  );
}

function partitionScreenResults(rankedTargets, screenResults) {
  const druggable = [];
  const undruggable = [];

  for (const target of rankedTargets) {
    const keys = [target.target_name, target.gene_symbol ?? ""]
      .map((n) => (n ?? "").toLowerCase().trim())
      .filter(Boolean);
    const screen = screenResults.find((r) => {
      const rk = (r.target_name ?? "").toLowerCase().trim();
      return keys.some((k) => k === rk || k.includes(rk) || rk.includes(k));
    });
    if (screen?.is_undruggable) {
      undruggable.push(screen);
    } else {
      druggable.push(target);
    }
  }

  return {
    druggable: druggable.map((t, i) => ({ ...t, rank: i + 1 })),
    undruggable,
  };
}

function buildBlockedAssessment(reason, screenedPrimary) {
  return {
    drug_exists: false,
    branch: "new",
    pipeline_status: "blocked_undruggable",
    blocked_reason: reason,
    screened_primary_target: screenedPrimary ?? undefined,
  };
}

async function loadGlobalUndruggable() {
  const { data, error } = await supabase
    .from("undruggable_targets")
    .select("*")
    .is("opportunity_object_id", null);
  if (error) throw error;
  return data ?? [];
}

async function fetchAssessments(opportunityId) {
  const { data, error } = await supabase
    .from("drug_discovery_assessments")
    .select("*")
    .eq("opportunity_object_id", opportunityId);
  if (error) throw error;
  return data ?? [];
}

async function main() {
  const globalUndruggable = await loadGlobalUndruggable();

  let oppQuery = supabase
    .from("opportunity_objects")
    .select("id, selected_phase2_hypothesis_id, top_hypothesis_id")
    .eq("schema_version", 3);

  if (filterId) {
    oppQuery = oppQuery.eq("id", filterId);
  }

  const { data: opportunities, error } = await oppQuery;
  if (error) throw error;

  let repaired = 0;
  for (const opp of opportunities ?? []) {
    const { data: sessionUndruggable } = await supabase
      .from("undruggable_targets")
      .select("*")
      .eq("opportunity_object_id", opp.id);

    const combinedRegistry = [...(sessionUndruggable ?? []), ...globalUndruggable];

    const { data: hypotheses } = await supabase
      .from("hypotheses")
      .select("id, rank, ranked_targets, hypothesis_stage")
      .eq("opportunity_object_id", opp.id)
      .order("rank", { ascending: true });

    let assessments = await fetchAssessments(opp.id);

    const selectivityHyps = (hypotheses ?? []).filter(
      (h) => h.hypothesis_stage === "selectivity"
    );

    for (const hyp of selectivityHyps) {
      const ranked = hyp.ranked_targets ?? [];
      if (ranked.length === 0) continue;

      const screenResults = ranked.map((t) => {
        const name = t.target_name || t.gene_symbol || "";
        const undruggable = isTargetUndraggable(name, combinedRegistry);
        return {
          target_name: name,
          is_undruggable: undruggable,
          failed_modalities: undruggable
            ? ["small_molecule", "biologic", "adc"]
            : [],
          reasoning: undruggable
            ? "Repaired: target in session or global undruggable registry."
            : "",
        };
      });

      const { druggable, undruggable } = partitionScreenResults(ranked, screenResults);
      const rerankedJson = JSON.stringify(druggable);

      if (JSON.stringify(ranked) !== rerankedJson) {
        console.log(
          `${dryRun ? "[dry-run] " : ""}Re-rank ${opp.id} hypothesis ${hyp.id}: ${ranked.length} → ${druggable.length} targets`
        );
        if (!dryRun) {
          await supabase
            .from("hypotheses")
            .update({ ranked_targets: druggable })
            .eq("id", hyp.id);
        }
        hyp.ranked_targets = druggable;
      }

      for (const entry of undruggable) {
        const exists = (sessionUndruggable ?? []).some((u) =>
          targetMatches(u.target_name, entry.target_name)
        );
        if (!exists) {
          console.log(
            `${dryRun ? "[dry-run] " : ""}Insert undruggable ${entry.target_name} for ${opp.id}`
          );
          if (!dryRun) {
            await supabase.from("undruggable_targets").insert({
              opportunity_object_id: opp.id,
              hypothesis_id: hyp.id,
              target_name: entry.target_name,
              intervention_point: "All modality classes",
              reasoning: entry.reasoning,
              rescan_eligible: true,
            });
          }
        }
      }
    }

    assessments = await fetchAssessments(opp.id);

    for (const assessment of assessments) {
      const hyp = (hypotheses ?? []).find((h) => h.id === assessment.hypothesis_id);
      const primary =
        hyp?.ranked_targets?.[0]?.target_name ??
        hyp?.ranked_targets?.[0]?.gene_symbol ??
        null;

      const primaryUndruggable =
        primary && isTargetUndraggable(primary, combinedRegistry);
      const emptyRanked = (hyp?.ranked_targets?.length ?? 0) === 0;
      const hypUndruggable = (sessionUndruggable ?? []).filter(
        (u) => u.hypothesis_id === hyp?.id
      );
      const legacyStaleDrugBranch =
        hypUndruggable.length > 0 &&
        (assessment.assessment?.druggability_score ?? 0) > 0;
      const needsBlocked =
        primaryUndruggable || emptyRanked || legacyStaleDrugBranch;

      const score = assessment.assessment?.druggability_score ?? 0;
      const needsRepair =
        needsBlocked &&
        (score > 0 ||
          assessment.assessment?.pipeline_status !== "blocked_undruggable" ||
          assessment.tpp_blueprint != null);

      if (!needsRepair) continue;

      let reason =
        "Repaired: no druggable ranked targets remain after screen.";
      if (primaryUndruggable) {
        reason = `Repaired: primary target ${primary} in undruggable registry — drug branch cleared.`;
      } else if (legacyStaleDrugBranch) {
        reason =
          "Repaired: legacy drug assessment cleared after undruggable target screen — direct target modulation not pursued.";
      }
      const patched = buildBlockedAssessment(reason, primary);

      console.log(
        `${dryRun ? "[dry-run] " : ""}Repair assessment ${opp.id} hypothesis ${assessment.hypothesis_id} (primary ${primary ?? "none"})`
      );

      if (!dryRun) {
        await supabase
          .from("drug_discovery_assessments")
          .update({
            assessment: patched,
            tpp_blueprint: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", assessment.id);
      }
      repaired++;
    }

    assessments = await fetchAssessments(opp.id);

    let selectedId =
      opp.selected_phase2_hypothesis_id ?? opp.top_hypothesis_id;
    const selectedAssessment = assessments.find(
      (a) => a.hypothesis_id === selectedId
    );
    const selectedBlocked =
      selectedAssessment?.assessment?.pipeline_status === "blocked_undruggable";

    const selectivitySorted = (hypotheses ?? [])
      .filter((h) => h.hypothesis_stage === "selectivity")
      .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));

    const firstDruggable = selectivitySorted.find((h) => {
      const a = assessments.find((x) => x.hypothesis_id === h.id);
      return (
        a?.assessment?.pipeline_status !== "blocked_undruggable" &&
        (h.ranked_targets?.length ?? 0) > 0
      );
    });

    if (selectedBlocked || !selectedId) {
      if (firstDruggable) {
        console.log(
          `${dryRun ? "[dry-run] " : ""}Promote hypothesis ${firstDruggable.id} for ${opp.id}`
        );
        if (!dryRun) {
          await supabase
            .from("opportunity_objects")
            .update({
              top_hypothesis_id: firstDruggable.id,
              selected_phase2_hypothesis_id: firstDruggable.id,
            })
            .eq("id", opp.id);
        }
      } else {
        console.log(
          `${dryRun ? "[dry-run] " : ""}Clear selected hypothesis for ${opp.id} (all blocked)`
        );
        if (!dryRun) {
          await supabase
            .from("opportunity_objects")
            .update({
              top_hypothesis_id: null,
              selected_phase2_hypothesis_id: null,
            })
            .eq("id", opp.id);
        }
      }
    } else if (
      firstDruggable &&
      selectedId !== firstDruggable.id &&
      selectedBlocked
    ) {
      console.log(
        `${dryRun ? "[dry-run] " : ""}Promote hypothesis ${firstDruggable.id} for ${opp.id}`
      );
      if (!dryRun) {
        await supabase
          .from("opportunity_objects")
          .update({
            top_hypothesis_id: firstDruggable.id,
            selected_phase2_hypothesis_id: firstDruggable.id,
          })
          .eq("id", opp.id);
      }
    }
  }

  console.log(`Done. ${repaired} assessment(s) ${dryRun ? "would be " : ""}repaired.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
