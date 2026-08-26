import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;
let cachedSignature = "";

/** Server-only authority for autonomous market evidence and read models. */
export function getMarketRuntimeClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) throw new Error("MARKET_RUNTIME_STORAGE_UNAVAILABLE");

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("MARKET_RUNTIME_STORAGE_UNAVAILABLE");
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.origin !== url.replace(/\/+$/, "")) {
    throw new Error("MARKET_RUNTIME_STORAGE_UNAVAILABLE");
  }

  const signature = `${url}\0${serviceRoleKey}`;
  if (!cachedClient || cachedSignature !== signature) {
    cachedClient = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    });
    cachedSignature = signature;
  }
  return cachedClient;
}
