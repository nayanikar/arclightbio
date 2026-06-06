import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

let v3SupabaseReady: boolean | undefined;

/** True when V3 tables/columns exist in Supabase; otherwise V3 uses file store overlay. */
export async function isV3SupabaseDbEnabled(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  if (v3SupabaseReady !== undefined) return v3SupabaseReady;

  const supabase = getSupabaseAdmin();
  const { error: cohortErr } = await supabase
    .from("patient_cohorts")
    .select("id")
    .limit(1);

  if (cohortErr?.code === "PGRST205" || cohortErr?.message?.includes("patient_cohorts")) {
    v3SupabaseReady = false;
    return false;
  }

  const { error: colErr } = await supabase
    .from("opportunity_objects")
    .select("parent_domain")
    .limit(1);

  if (colErr?.code === "42703" || colErr?.message?.includes("parent_domain")) {
    v3SupabaseReady = false;
    return false;
  }

  v3SupabaseReady = !cohortErr && !colErr;
  return v3SupabaseReady;
}

export function resetV3SupabaseReadyCache(): void {
  v3SupabaseReady = undefined;
}
