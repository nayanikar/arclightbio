/**
 * Pause all agents_running V3 sessions in local file store + Supabase.
 * Usage: node scripts/pause-running-sessions.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const STORE = path.join(ROOT, ".data/store.json");

function loadEnv() {
  const text = readFileSync(path.join(ROOT, ".env.local"), "utf-8");
  return Object.fromEntries(
    text
      .split("\n")
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      })
  );
}

const store = JSON.parse(readFileSync(STORE, "utf-8"));
const paused = [];

for (const [id, row] of Object.entries(store.opportunities ?? {})) {
  if (row.status === "agents_running") {
    row.status = "paused";
    row.blackboard_state = {
      ...(row.blackboard_state ?? { completedSteps: [] }),
      pauseReason: "user_stopped",
    };
    paused.push(id);
  }
}

writeFileSync(STORE, JSON.stringify(store, null, 2));
console.log(`Paused ${paused.length} session(s) in file store:`);
paused.forEach((id) => console.log(`  ${id}`));

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (url && key) {
  const res = await fetch(
    `${url}/rest/v1/opportunity_objects?status=eq.agents_running&select=id`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  const rows = await res.json();
  if (Array.isArray(rows) && rows.length > 0) {
    for (const row of rows) {
      await fetch(`${url}/rest/v1/opportunity_objects?id=eq.${row.id}`, {
        method: "PATCH",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ status: "paused" }),
      });
      console.log(`Paused in Supabase: ${row.id}`);
    }
  }
}
