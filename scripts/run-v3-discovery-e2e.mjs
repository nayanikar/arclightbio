/**
 * Launch a V3 discovery session and poll until complete or failed.
 * Usage: node scripts/run-v3-discovery-e2e.mjs [--base http://localhost:3000]
 */
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.argv.includes("--base")
  ? process.argv[process.argv.indexOf("--base") + 1]
  : "http://localhost:3000";

const QUERY =
  "cancer patients without dominant oncogenic mutation, could be with loss of function mutation";
const PARENT_DOMAIN = "oncology";
const CSV_PATH = path.join(__dirname, "../test-data/oncology-lof-no-driver-cohort.csv");
const POLL_MS = 20_000;
const MAX_WAIT_MS = 45 * 60 * 1000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const cohortCsv = readFileSync(CSV_PATH, "utf-8");

  const metaRes = await fetch(`${BASE}/api/discover`);
  if (!metaRes.ok) throw new Error(`GET /api/discover failed: ${metaRes.status}`);
  const meta = await metaRes.json();
  const orgContextId =
    meta.orgContexts?.[0]?.id ?? meta.defaultOrgContextId ?? undefined;

  console.log(`\nLaunching V3 discovery at ${BASE}`);
  console.log(`Query: ${QUERY}`);
  console.log(`Parent domain: ${PARENT_DOMAIN}`);
  console.log(`Cohort rows: ${cohortCsv.trim().split("\n").length - 1}\n`);

  const createRes = await fetch(`${BASE}/api/discover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: QUERY,
      parentDomain: PARENT_DOMAIN,
      orgContextId,
      cohortCsv,
    }),
  });
  const created = await createRes.json();
  if (!createRes.ok) {
    throw new Error(`POST /api/discover failed: ${created.error ?? createRes.status}`);
  }

  const id = created.id;
  console.log(`Session created: ${id}`);
  console.log(`Opportunity URL: ${BASE}/opportunity/${id}\n`);

  const started = Date.now();
  let lastPhase = "";

  while (Date.now() - started < MAX_WAIT_MS) {
    const statusRes = await fetch(`${BASE}/api/opportunity/${id}/status`);
    const status = await statusRes.json();
    if (!statusRes.ok) throw new Error(`Status poll failed: ${status.error}`);

    const phase = status.blackboard_state?.completedSteps?.slice(-1)?.[0] ?? status.v3_phase ?? "";
    if (phase !== lastPhase) {
      lastPhase = phase;
      console.log(
        `[${new Date().toISOString()}] status=${status.status} phase=${phase || "—"} hypotheses=${status.hypothesis_count ?? "?"}`
      );
    }

    if (status.status === "complete") {
      console.log("\nPipeline complete. Verifying Phase 2 for all selectivity hypotheses…\n");
      await verifySession(id);
      return;
    }
    if (status.status === "agents_failed" || status.status === "failed") {
      const err = status.blackboard_state?.lastError ?? "unknown";
      throw new Error(`Pipeline failed: ${err}`);
    }

    await sleep(POLL_MS);
  }

  throw new Error("Timed out waiting for pipeline completion");
}

async function verifySession(opportunityId) {
  const objRes = await fetch(`${BASE}/api/opportunity/${opportunityId}`);
  const obj = await objRes.json();
  if (!objRes.ok) throw new Error(`GET opportunity failed: ${obj.error}`);

  const selectivity = (obj.hypotheses ?? []).filter(
    (h) => h.hypothesis_stage === "selectivity"
  );
  console.log(`Selectivity hypotheses: ${selectivity.length}`);

  const checks = [];
  for (const h of selectivity.sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))) {
    const artRes = await fetch(
      `${BASE}/api/opportunity/${opportunityId}?hypothesisId=${h.id}`
    );
    const art = await artRes.json();
    const hasDrug = art.drug_discovery_assessment != null;
    const hasInd = art.ind_package_v3 != null;
    checks.push({ rank: h.rank, id: h.id, hasDrug, hasInd });
    console.log(
      `  #${h.rank} ${hasDrug ? "✓" : "✗"} drug assessment  ${hasInd ? "✓" : "✗"} IND package`
    );
  }

  const allPhase2 = checks.length >= 3 && checks.every((c) => c.hasDrug && c.hasInd);
  if (!allPhase2) {
    throw new Error("Not all selectivity hypotheses have Phase 2 artifacts");
  }

  console.log("\nAll 3 selectivity hypotheses have Phase 2 drug + IND artifacts.");
  console.log(`population_definition: ${obj.population_definition ? "yes" : "no"}`);
  console.log(`expert_domains: ${obj.expert_domains?.length ?? 0}`);
  console.log(`association stage count: ${(obj.hypotheses ?? []).filter((h) => h.hypothesis_stage === "association").length}`);
  console.log(`\nE2E PASS — ${BASE}/opportunity/${opportunityId}\n`);
}

main().catch((err) => {
  console.error("\nE2E FAILED:", err.message);
  process.exit(1);
});
