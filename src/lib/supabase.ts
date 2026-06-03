import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supabaseAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (supabaseAdmin) return supabaseAdmin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  supabaseAdmin = createClient(url, key);
  return supabaseAdmin;
}

export function getSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase not configured.");
  }

  return createClient(url, key);
}

const PLACEHOLDER_PATTERNS = [
  /^your_/i,
  /^replace/i,
  /^changeme/i,
  /^xxx/i,
  /^placeholder/i,
];

function isRealEnvValue(value: string | undefined): boolean {
  if (!value || value.trim().length === 0) return false;
  return !PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value.trim()));
}

function isValidSupabaseUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return (
    isRealEnvValue(url) &&
    isRealEnvValue(key) &&
    isValidSupabaseUrl(url!.trim())
  );
}
