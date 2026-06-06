/**
 * Poll a V3 opportunity and flag Claude/rate-limit errors.
 * Usage: node scripts/monitor-pipeline.mjs <opportunityId> [--base http://localhost:3000]
 */
const id = process.argv[2];
const base =
  process.argv.includes("--base")
    ? process.argv[process.argv.indexOf("--base") + 1]
    : "http://localhost:3000";

if (!id) {
  console.error("Usage: node scripts/monitor-pipeline.mjs <opportunityId>");
  process.exit(1);
}

const RATE_LIMIT_PATTERNS = [
  /rate.?limit/i,
  /429/,
  /overloaded/i,
  /too many requests/i,
  /quota/i,
  /capacity/i,
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log(`Monitoring ${base}/opportunity/${id}\n`);
  const started = Date.now();

  while (Date.now() - started < 60 * 60 * 1000) {
    const statusRes = await fetch(`${base}/api/opportunity/${id}/status`);
    const status = await statusRes.json();
    const steps = status.blackboard_state?.completedSteps ?? [];
    const lastStep = steps[steps.length - 1] ?? "—";
    const err = status.blackboard_state?.lastError ?? "";

    console.log(
      `[${new Date().toISOString()}] status=${status.status} step=${lastStep} hyps=${status.hypothesis_count ?? "?"}`
    );

    if (RATE_LIMIT_PATTERNS.some((p) => p.test(err))) {
      console.error("\n⚠ RATE LIMIT DETECTED:", err);
      process.exit(2);
    }

    if (err && status.status === "agents_failed") {
      console.error("\n✗ Pipeline failed:", err);
      if (RATE_LIMIT_PATTERNS.some((p) => p.test(err))) process.exit(2);
      process.exit(1);
    }

    if (status.status === "complete") {
      console.log("\n✓ Pipeline complete");
      const obj = await (await fetch(`${base}/api/opportunity/${id}`)).json();
      const sel = (obj.hypotheses ?? []).filter((h) => h.hypothesis_stage === "selectivity");
      console.log(`Selectivity hypotheses: ${sel.length}`);
      for (const h of sel.sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))) {
        const art = await (
          await fetch(`${base}/api/opportunity/${id}?hypothesisId=${h.id}`)
        ).json();
        console.log(
          `  #${h.rank} drug=${art.drug_discovery_assessment ? "yes" : "no"} ind=${art.ind_package_v3 ? "yes" : "no"}`
        );
      }
      process.exit(0);
    }

    await sleep(30_000);
  }
  console.error("Timed out after 60 minutes");
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
