import "server-only";

import { createServerClient, type CookieOptionsWithName } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export class SupabaseSsrConfigurationError extends Error {
  constructor() {
    super("Authentication is unavailable.");
    this.name = "SupabaseSsrConfigurationError";
  }
}

function readPublicSupabaseConfiguration(): Readonly<{
  anonKey: string;
  url: string;
}> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    throw new SupabaseSsrConfigurationError();
  }

  try {
    const parsed = new URL(url);
    if (parsed.origin !== url.replace(/\/+$/, "") || parsed.username || parsed.password) {
      throw new SupabaseSsrConfigurationError();
    }
  } catch {
    throw new SupabaseSsrConfigurationError();
  }

  return Object.freeze({ anonKey, url });
}

export async function createSupabaseSsrServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  const { anonKey, url } = readPublicSupabaseConfiguration();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        values: ReadonlyArray<{
          name: string;
          options: CookieOptionsWithName;
          value: string;
        }>,
      ) {
        try {
          for (const { name, value, options } of values) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. Route Handlers can.
        }
      },
    },
  });
}
