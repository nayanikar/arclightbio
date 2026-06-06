/**
 * Repair V3 sessions misclassified as agents_failed due to file-overlay / Supabase split.
 * Usage: node scripts/repair-v3-failed.mjs [opportunity-id ...]
 */
import { config } from "dotenv";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

config({ path: ".env.local" });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const store = JSON.parse(readFileSync(path.join(root, ".data/store.json"), "utf8"));
const v3Store = JSON.parse(readFileSync(path.join(root, ".data/v3-store.json"), "utf8"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const DEFAULT_IDS = [
  "38ea08a2-3701-4168-a12c-8dfb63b252f2",
  "e29cd89f-34eb-4ce0-aed6-4138460693c7",
];

async function sb(pathname, options = {}) {
  const res = await fetch(`${url}/rest/v1/${pathname}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${pathname}: ${text}`);
  return text ? JSON.parse(text) : null;
}

function overlayHyps(opportunityId) {
  const fromStore = store.hypotheses?.[opportunityId] ?? [];
  const fromV3 = v3Store.hypotheses?.[opportunityId] ?? [];
  const byId = new Map();
  for (const h of fromStore) byId.set(h.id, h);
  for (const h of fromV3) byId.set(h.id, h);
  return [...byId.values()];
}

function toRow(opportunityId, h) {
  return {
    id: h.id,
    opportunity_object_id: opportunityId,
    rank: h.rank,
    is_outgroup: h.is_outgroup ?? false,
    statement: h.statement,
    patient_population: h.patient_population,
    unmet_need: h.unmet_need,
    org_positioning: h.org_positioning ?? "",
    source: h.source ?? null,
    hypothesis_stage: h.hypothesis_stage,
    parent_hypothesis_id: h.parent_hypothesis_id,
    falsifiability_statement: h.falsifiability_statement,
    anchor_type: h.anchor_type,
    anchor_linkage: h.anchor_linkage,
    dropped_links: h.dropped_links ?? [],
    new_moa_requires_experiment: h.new_moa_requires_experiment ?? false,
    mechanistic_chain: h.mechanistic_chain,
    intervention_direction_hypothesis: h.intervention_direction_hypothesis,
    direction_status: h.direction_status,
    direction_hypotheses: h.direction_hypotheses ?? [],
    rank_decomposition: h.rank_decomposition,
    ranking_rationale: h.ranking_rationale,
    ranked_targets: h.ranked_targets,
    falsification_experiment: h.falsification_experiment,
    target_family_context: h.target_family_context,
  };
}

const REPAIR_RESET_FROM = "phase1:causation_filter";
const PHASE_ORDER = [
  "phase1:population",
  "phase1:anchors",
  "phase1:market_size",
  "phase1:cd1",
  "phase1:cd2",
  "phase1:expert_domains",
  "phase1:biology_recurrence",
  "phase1:association_filter",
  "phase1:literature_review",
  "phase1:context_mine",
  "phase1:association_generate",
  "phase1:causation_filter",
  "phase1:selectivity_filter",
  "phase1:selectivity_rank",
  "phase1:complete",
];

async function repair(id) {
  const [row] = await sb(
    `opportunity_objects?id=eq.${id}&select=id,status,schema_version,blackboard_state`
  );
  if (!row || row.status !== "agents_failed" || row.schema_version !== 3) {
    console.log(id, "skip — not agents_failed v3");
    return;
  }

  const existing = await sb(
    `hypotheses?opportunity_object_id=eq.${id}&select=id,hypothesis_stage`
  );
  if ((existing ?? []).length === 0) {
    const overlay = overlayHyps(id);
    if (overlay.length > 0) {
      await sb("hypotheses", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify(overlay.map((h) => toRow(id, h))),
      });
      console.log(id, `synced ${overlay.length} hypotheses`);
    }
  }

  const fields = v3Store.opportunityFields?.[id] ?? {};
  const patch = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v != null && k !== "cohort_id") patch[k] = v;
  }
  if (Object.keys(patch).length > 0) {
    patch.last_updated = new Date().toISOString();
    await sb(`opportunity_objects?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    console.log(id, "synced v3 fields");
  }

  const hyps = await sb(
    `hypotheses?opportunity_object_id=eq.${id}&select=id,hypothesis_stage`
  );
  const selectivity = hyps.filter((h) => h.hypothesis_stage === "selectivity");
  const association = hyps.filter((h) => h.hypothesis_stage === "association");
  const completed = row.blackboard_state?.completedSteps ?? [];

  if (selectivity.length > 0) {
    await sb(`opportunity_objects?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "complete" }),
    });
    console.log(id, "→ complete (has selectivity)");
    return;
  }

  if (association.length > 0 && completed.includes("phase1:complete")) {
    const cutoff = PHASE_ORDER.indexOf(REPAIR_RESET_FROM);
    const nextCompleted = completed.filter((step) => {
      const stepBase = step.split(":").slice(0, 2).join(":");
      const stepIdx = PHASE_ORDER.findIndex(
        (s) => s === stepBase || step.startsWith(s)
      );
      return stepIdx < cutoff || cutoff < 0;
    });
    await sb(`opportunity_objects?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "paused",
        v3_phase: REPAIR_RESET_FROM,
        blackboard_state: {
          ...row.blackboard_state,
          completedSteps: nextCompleted,
          lastError: undefined,
          pauseReason: "user_stopped",
          repairNote:
            "Phase 1 funnel reset — resume to continue causation/selectivity steps.",
        },
        last_updated: new Date().toISOString(),
      }),
    });
    console.log(id, "→ paused (resume to finish Phase 1 funnel)");
    return;
  }

  await sb(`opportunity_objects?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "complete",
      actionability_zone: "too_early",
      blackboard_state: {
        ...row.blackboard_state,
        lastError: undefined,
        outcome: "phase1_complete_no_selectivity",
      },
    }),
  });
  console.log(id, "→ complete (phase1 only, no selectivity)");
}

const ids = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_IDS;
for (const id of ids) {
  await repair(id);
}
