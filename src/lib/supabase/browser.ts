"use client";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";

let client: ReturnType<typeof createClient<Database>> | null = null;

/**
 * Browser Supabase client using the ANON (publishable) key.
 * RLS allows SELECT only — used for reads and Realtime subscriptions.
 * Singleton so we don't open multiple realtime sockets.
 */
export function getBrowserClient() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  client = createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 10 } },
  });
  return client;
}
