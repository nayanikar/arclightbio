import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supabaseAdmin: SupabaseClient | null = null;

function resolveAdminKey(): string | undefined {
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceRole) return serviceRole;

  // Dev-only fallback: never use anon key as admin client in production.
  if (process.env.NODE_ENV === "production") {
    return undefined;
  }

  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

export function getSupabaseAdmin(): SupabaseClient {
  if (supabaseAdmin) return supabaseAdmin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = resolveAdminKey();

  if (!url || !key) {
    throw new Error(
      process.env.NODE_ENV === "production"
        ? "Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
        : "Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY for local dev)."
    );
  }

  supabaseAdmin = createClient(url, key, {
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, cache: "no-store" }),
    },
  });
  return supabaseAdmin;
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
  const key = resolveAdminKey();

  return (
    isRealEnvValue(url) &&
    isRealEnvValue(key) &&
    isValidSupabaseUrl(url!.trim())
  );
}
