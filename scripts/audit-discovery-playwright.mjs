#!/usr/bin/env node
/**
 * Visual + functional Playwright audit for a V3 discovery session.
 * Usage: node scripts/audit-discovery-playwright.mjs <opportunityId> [--base http://localhost:3000]
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

if (!id) {
  console.error("Usage: node scripts/audit-discovery-playwright.mjs <opportunityId> [--base URL]");
  process.exit(1);
}

const outDir = path.join(__dirname, "../.playwright-audit", id);
mkdirSync(outDir, { recursive: true });

async function fetchStatus() {
  const res = await fetch(`${base}/api/opportunity/${id}/status`);
  return res.json();
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const findings = [];

  // Discover page defaults (fresh tab)
  await page.goto(`${base}/discover`, { waitUntil: "networkidle", timeout: 60000 });
  const mediumBtn = page.locator('button:has-text("Medium Risk, Medium Innovation")');
  const mediumClass = (await mediumBtn.getAttribute("class")) ?? "";
  findings.push({
    check: "discover_default_innovation_medium",
    pass: mediumClass.includes("ring") || mediumClass.includes("amber"),
    detail: mediumClass.slice(0, 120),
  });
  const helper = await page.getByText("Seeds your discovery thesis").textContent();
  findings.push({
    check: "discover_thesis_copy",
    pass: helper?.includes("discovery thesis") ?? false,
    detail: helper,
  });
  await page.screenshot({ path: path.join(outDir, "01-discover.png"), fullPage: true });

  // Opportunity page — live session
  const oppUrl = `${base}/opportunity/${id}`;
  await page.goto(oppUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(5000);

  const status = await fetchStatus();
  const phase = status.blackboard_state?.completedSteps?.slice(-1)[0] ?? "—";
  findings.push({
    check: "session_status_running_or_complete",
    pass: ["agents_running", "complete", "paused"].includes(status.status),
    detail: `status=${status.status} phase=${phase} hypotheses=${status.hypothesis_count}`,
  });

  const hero = await page.locator("h1").first().textContent().catch(() => "");
  findings.push({
    check: "hero_discovery_thesis_present",
    pass: Boolean(hero?.trim()) && !hero?.includes("Loading"),
    detail: hero?.slice(0, 160),
  });

  const pills = await page.locator('[class*="font-mono"]').allTextContents();
  const pillText = pills.join(" ");
  findings.push({
    check: "cohort_linked_pill",
    pass: pillText.toLowerCase().includes("cohort"),
    detail: pillText.slice(0, 200),
  });

  const agentActivity = await page.getByText("Agent activity").isVisible().catch(() => false);
  findings.push({
    check: "live_agent_sidebar",
    pass: agentActivity,
    detail: String(agentActivity),
  });

  await page.screenshot({ path: path.join(outDir, "02-opportunity-early.png"), fullPage: true });

  // Dashboard
  await page.goto(`${base}/`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  const dashTitle = await page.locator("h1").first().textContent();
  findings.push({
    check: "dashboard_loads",
    pass: dashTitle?.includes("Opportunity queue") ?? false,
    detail: dashTitle,
  });
  await page.screenshot({ path: path.join(outDir, "03-dashboard.png"), fullPage: true });

  await browser.close();

  const passed = findings.filter((f) => f.pass).length;
  console.log(`\nPlaywright audit — ${id}`);
  console.log(`Screenshots: ${outDir}\n`);
  for (const f of findings) {
    console.log(`${f.pass ? "✓" : "✗"} ${f.check}: ${f.detail}`);
  }
  console.log(`\n${passed}/${findings.length} checks passed\n`);
  process.exit(passed === findings.length ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
