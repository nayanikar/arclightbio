#!/usr/bin/env node
/**
 * Backfill program_trust_score + program_trust_breakdown for V3 opportunities.
 * Usage: node scripts/backfill-program-trust.mjs [--dry-run] [--id=<uuid>]
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

const FUNNEL_TARGETS = {
  association: 50,
  causation: 20,
  selectivity: 3,
};

function clamp01(n) {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function trustLabel(overall) {
  if (overall >= 0.7) return "strong";
  if (overall >= 0.45) return "moderate";
  return "exploratory";
}

function funnelCoverage(hypotheses) {
  const nonOutgroup = hypotheses.filter((h) => !h.is_outgroup);
  const association = nonOutgroup.filter((h) => h.hypothesis_stage === "association").length;
  const causation = nonOutgroup.filter((h) => h.hypothesis_stage === "causation").length;
  const selectivity = nonOutgroup.filter(
    (h) =>
      h.hypothesis_stage === "selectivity" ||
      (h.rank != null && h.rank >= 1 && h.rank <= 3)
  ).length;

  const ratios = [
    association / FUNNEL_TARGETS.association,
    causation / FUNNEL_TARGETS.causation,
    selectivity / FUNNEL_TARGETS.selectivity,
  ].map(clamp01);

  return ratios.reduce((sum, r) => sum + r, 0) / ratios.length;
}

function evidenceStrength(selectivityHyps) {
  const ranked = selectivityHyps
    .filter((h) => !h.is_outgroup)
    .filter((h) => h.rank != null && h.rank >= 1 && h.rank <= 3)
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
    .slice(0, 3);

  if (ranked.length === 0) return 0;

  const confidences = ranked.map(
    (h) => h.mechanistic_chain?.overall_chain_confidence ?? 0
  );
  return confidences.reduce((sum, c) => sum + clamp01(c), 0) / confidences.length;
}

function biologySignal(expertDomains, cd2Associations) {
  const biologyRates = (expertDomains ?? [])
    .map((d) => d.biology_recurrence_rate ?? d.recurrence_rate ?? 0)
    .filter((n) => typeof n === "number" && !Number.isNaN(n));

  if (biologyRates.length > 0) {
    return clamp01(Math.max(...biologyRates));
  }

  const cd2Conf = (cd2Associations ?? [])
    .map((a) => a.confidence ?? 0)
    .filter((n) => typeof n === "number" && !Number.isNaN(n));

  if (cd2Conf.length > 0) {
    return clamp01(Math.max(...cd2Conf));
  }

  return 0;
}

function computeProgramTrustScore({ hypotheses, expert_domains, cd2_associations }) {
  const selectivityHyps = hypotheses.filter(
    (h) =>
      !h.is_outgroup &&
      (h.hypothesis_stage === "selectivity" ||
        (h.rank != null && h.rank >= 1 && h.rank <= 3))
  );

  const funnel_coverage = funnelCoverage(hypotheses);
  const evidence_strength = evidenceStrength(selectivityHyps);
  const biology_signal = biologySignal(expert_domains, cd2_associations);

  const overall = clamp01(
    0.35 * funnel_coverage + 0.45 * evidence_strength + 0.2 * biology_signal
  );

  return {
    overall: Math.round(overall * 10000) / 10000,
    funnel_coverage: Math.round(funnel_coverage * 10000) / 10000,
    evidence_strength: Math.round(evidence_strength * 10000) / 10000,
    biology_signal: Math.round(biology_signal * 10000) / 10000,
    label: trustLabel(overall),
  };
}

async function main() {
  let query = supabase
    .from("opportunity_objects")
    .select(
      "id, program_trust_score, expert_domains, cd2_associations, schema_version"
    )
    .eq("schema_version", 3)
    .is("program_trust_score", null);

  if (filterId) {
    query = query.eq("id", filterId);
  }

  const { data: opportunities, error } = await query;
  if (error) throw error;

  let updated = 0;
  for (const opp of opportunities ?? []) {
    const { data: hypotheses, error: hypError } = await supabase
      .from("hypotheses")
      .select("*")
      .eq("opportunity_object_id", opp.id);
    if (hypError) throw hypError;

    const trust = computeProgramTrustScore({
      hypotheses: hypotheses ?? [],
      expert_domains: opp.expert_domains,
      cd2_associations: opp.cd2_associations,
    });

    console.log(
      `${dryRun ? "[dry-run] " : ""}Backfill ${opp.id} trust=${trust.overall} (${trust.label})`
    );

    if (!dryRun) {
      const { error: updateError } = await supabase
        .from("opportunity_objects")
        .update({
          program_trust_score: trust.overall,
          program_trust_breakdown: trust,
          last_updated: new Date().toISOString(),
        })
        .eq("id", opp.id);
      if (updateError) throw updateError;
    }
    updated++;
  }

  console.log(
    `Done. ${updated} program(s) ${dryRun ? "would be " : ""}backfilled.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
