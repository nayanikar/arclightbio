#!/usr/bin/env node
/**
 * Post-completion Playwright audit for V3 discovery session.
 */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const id = process.argv[2];
const base = process.argv.includes("--base")
  ? process.argv[process.argv.indexOf("--base") + 1]
  : "http://localhost:3000";

if (!id) process.exit(1);

const outDir = path.join(__dirname, "../.playwright-audit", id);
mkdirSync(outDir, { recursive: true });

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const findings = [];

  await page.goto(`${base}/opportunity/${id}`, {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  await page.waitForTimeout(3000);

  const statusRes = await fetch(`${base}/api/opportunity/${id}/status`);
  const status = await statusRes.json();
  findings.push({
    check: "pipeline_complete",
    pass: status.status === "complete",
    detail: status.status,
  });

  const pillText =
    (await page.locator("header.v3-hero-grid").textContent()) ?? "";
  findings.push({
    check: "status_complete_pill",
    pass: /complete/i.test(pillText),
    detail: pillText.slice(0, 120),
  });
  findings.push({
    check: "phase2_complete_pill",
    pass: /phase 2 complete/i.test(pillText),
    detail: "",
  });
  findings.push({
    check: "medium_innovation_pill",
    pass: /medium risk/i.test(pillText),
    detail: "",
  });

  const phase2Visible = await page.getByText("Phase 2 · drug development").isVisible();
  findings.push({
    check: "phase2_section_visible",
    pass: phase2Visible,
    detail: String(phase2Visible),
  });

  const drugBranch = await page.getByText("Drug branch").first().isVisible().catch(() => false);
  findings.push({
    check: "drug_branch_visible",
    pass: drugBranch,
    detail: String(drugBranch),
  });

  const tpp = await page.getByText("TPP blueprint").isVisible().catch(() => false);
  findings.push({
    check: "tpp_panel_visible",
    pass: tpp,
    detail: String(tpp),
  });

  const trust = await page.getByText("Discovery confidence").isVisible().catch(() => false);
  findings.push({
    check: "trust_badge_visible",
    pass: trust,
    detail: String(trust),
  });

  const funnel = await page.getByText("Hypothesis funnel").isVisible();
  findings.push({
    check: "funnel_panel",
    pass: funnel,
    detail: String(funnel),
  });

  await page.screenshot({ path: path.join(outDir, "04-complete-opportunity.png"), fullPage: true });

  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const hasProgram = await page.getByText(/ARID1A|chromatin|discovery thesis/i).first().isVisible().catch(() => false);
  findings.push({
    check: "dashboard_lists_program",
    pass: hasProgram,
    detail: String(hasProgram),
  });
  await page.screenshot({ path: path.join(outDir, "05-complete-dashboard.png"), fullPage: true });

  await browser.close();

  const passed = findings.filter((f) => f.pass).length;
  console.log(`\nPost-completion Playwright audit — ${id}\n`);
  for (const f of findings) {
    console.log(`${f.pass ? "✓" : "✗"} ${f.check}${f.detail ? ": " + f.detail : ""}`);
  }
  console.log(`\n${passed}/${findings.length} passed\n`);
  process.exit(passed === findings.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
