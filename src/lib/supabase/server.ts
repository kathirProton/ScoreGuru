import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";

// Next.js caches fetch() by default — including the requests supabase-js makes —
// which would serve stale rows on dynamic pages. Force fresh reads/writes.
const noStoreFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, cache: "no-store" });

/**
 * Server-only Supabase client using the SERVICE ROLE key.
 * Bypasses Row Level Security — every write in the app goes through this,
 * gated by the admin session check in server actions / route handlers.
 * NEVER import this from a client component.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars."
    );
  }
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: noStoreFetch },
  });
}

/**
 * Server-side read client using the ANON key (respects RLS: SELECT only).
 * Used for public pages rendered on the server.
 */
export function createReadClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars."
    );
  }
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: noStoreFetch },
  });
}
