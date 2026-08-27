import "server-only";

import type { AdminGuardContext } from "../lib/auth/admin-request-guard.server";
import { createGuardedServiceRoleClient } from "../lib/supabase/service-role.server";
import {
  persistExternalMarketImport,
  type ExternalMarketImportInput,
} from "./external-market-import.service";

export function persistGuardedExternalMarketImport(
  input: ExternalMarketImportInput,
  context: AdminGuardContext,
) {
  return persistExternalMarketImport(input, createGuardedServiceRoleClient(context));
}
