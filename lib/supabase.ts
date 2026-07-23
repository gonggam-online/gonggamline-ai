import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type SupabaseAvailability =
  | { status: "configured"; url: string; anonKey: string }
  | { status: "unconfigured"; reason: "missing_url" | "missing_anon_key" }
  | { status: "invalid"; reason:
      | "malformed_url"
      | "insecure_production_url"
      | "placeholder_configuration"
      | "url_contains_credentials" };

let cachedClient: SupabaseClient | null = null;
let cachedSignature = "";

export function getSupabaseAvailability(
  environment: Record<string, string | undefined> = process.env,
): SupabaseAvailability {
  const url = environment.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = environment.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url) return { status: "unconfigured", reason: "missing_url" };
  if (!anonKey) return { status: "unconfigured", reason: "missing_anon_key" };
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { status: "invalid", reason: "malformed_url" };
  }
  if (/YOUR_PROJECT|placeholder/i.test(url)
    || /YOUR_SUPABASE|placeholder/i.test(anonKey)) {
    return { status: "invalid", reason: "placeholder_configuration" };
  }

  const localHost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.username || parsed.password) {
    return { status: "invalid", reason: "url_contains_credentials" };
  }
  if (environment.NODE_ENV === "production" && (parsed.protocol !== "https:" || localHost)) {
    return { status: "invalid", reason: "insecure_production_url" };
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { status: "invalid", reason: "malformed_url" };
  }

  return { status: "configured", url: parsed.toString().replace(/\/$/, ""), anonKey };
}

export class SupabaseUnavailableError extends Error {
  readonly availability: Exclude<SupabaseAvailability, { status: "configured" }>;

  constructor(availability: Exclude<SupabaseAvailability, { status: "configured" }>) {
    super(`Supabase is ${availability.status}`);
    this.name = "SupabaseUnavailableError";
    this.availability = availability;
  }
}

export function getSupabaseClient(): SupabaseClient {
  const availability = getSupabaseAvailability();
  if (availability.status !== "configured") {
    throw new SupabaseUnavailableError(availability);
  }

  const signature = `${availability.url}\0${availability.anonKey}`;
  if (!cachedClient || cachedSignature !== signature) {
    cachedClient = createClient(availability.url, availability.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    cachedSignature = signature;
  }
  return cachedClient;
}

export const isSupabaseConfigured =
  getSupabaseAvailability().status === "configured";

// Compatibility proxy: existing services remain lazy and no client is created on import.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property) {
    const client = getSupabaseClient();
    const value: unknown = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
