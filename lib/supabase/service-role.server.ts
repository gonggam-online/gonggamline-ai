import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  isSameRequestAdminGuardContext,
  type AdminGuardContext,
} from "../auth/admin-request-guard.server";

class ServiceRoleConfigurationError extends Error {
  constructor() {
    super("Protected data access is unavailable.");
    this.name = "ServiceRoleConfigurationError";
  }
}

export function createGuardedServiceRoleClient(
  guardContext: AdminGuardContext,
): SupabaseClient {
  if (
    !guardContext ||
    !isSameRequestAdminGuardContext(guardContext) ||
    !guardContext.administratorUserId ||
    !guardContext.sessionIdentity ||
    !guardContext.correlationId ||
    !guardContext.route
  ) {
    throw new ServiceRoleConfigurationError();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) {
    throw new ServiceRoleConfigurationError();
  }

  try {
    const parsed = new URL(url);
    if (parsed.origin !== url.replace(/\/+$/, "") || parsed.username || parsed.password) {
      throw new ServiceRoleConfigurationError();
    }
  } catch {
    throw new ServiceRoleConfigurationError();
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
