import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const envText = readFileSync(".env.local", "utf-8");
const env = Object.fromEntries(
  envText
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { error: e1 } = await sb.from("patient_cohorts").select("id").limit(1);
console.log("patient_cohorts:", e1 ? e1.message : "OK");

const { error: e2 } = await sb
  .from("opportunity_objects")
  .select("population_definition,cd1_patterns")
  .limit(1);
console.log("v3 cols:", e2 ? e2.message : "OK");
