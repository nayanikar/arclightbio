#!/usr/bin/env node
/**
 * Capture marketing screenshots for the Arclight Bio home page.
 * Usage: node scripts/capture-marketing.mjs [opportunityId] [--base http://localhost:3000]
 */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const opportunityId = process.argv[2];
const base = process.argv.includes("--base")
  ? process.argv[process.argv.indexOf("--base") + 1]
  : "http://localhost:3000";

const outDir = path.join(__dirname, "../public/marketing");
mkdirSync(outDir, { recursive: true });

async function scrollToText(page, text) {
  const locator = page.getByText(text, { exact: false }).first();
  await locator.waitFor({ state: "visible", timeout: 60000 });
  await locator.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
}

async function capture(page, name, options = {}) {
  const file = path.join(outDir, `${name}.png`);
  if (options.fullPage) {
    await page.screenshot({ path: file, fullPage: true });
  } else {
    await page.screenshot({ path: file });
  }
  console.log(`Saved ${file}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  await page.goto(`${base}/`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(1500);
  await capture(page, "home");

  await page.goto(`${base}/discover`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(1000);
  await capture(page, "discover");

  await page.goto(`${base}/dashboard`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(2000);
  await capture(page, "dashboard");

  await page.goto(`${base}/undruggable`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(2000);
  await capture(page, "undruggable-registry");

  if (opportunityId) {
    await page.goto(`${base}/opportunity/${opportunityId}`, {
      waitUntil: "networkidle",
      timeout: 120000,
    });
    await page.waitForTimeout(3000);

    await scrollToText(page, "Anchor profiles");
    await capture(page, "anchors");

    await scrollToText(page, "Expert domains");
    await capture(page, "expert-domains");

    await scrollToText(page, "Hypothesis funnel");
    await capture(page, "hypothesis-funnel");

    for (const label of ["IND package", "Druggability screen", "Phase 2", "Target to IND"]) {
      try {
        await scrollToText(page, label);
        break;
      } catch {
        /* try next label */
      }
    }
    await page.waitForTimeout(500);
    await capture(page, "phase2-ind");
  } else {
    console.warn(
      "No opportunityId provided — skipping opportunity panel screenshots (anchors, expert-domains, hypothesis-funnel, phase2-ind)."
    );
  }

  await browser.close();
  console.log("Marketing capture complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
