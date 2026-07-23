import { createClient } from "@supabase/supabase-js";

const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const configuredAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(
  configuredUrl && configuredAnonKey,
);

// Keep route modules loadable when the optional database integration is absent.
const supabaseUrl = configuredUrl ?? "http://127.0.0.1:54321";
const supabaseAnonKey = configuredAnonKey ?? "runtime-not-configured";

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);
