import "server-only";

import {
  CreativeStorageError,
  ManagedListingCreativeStorage,
} from "@/engines/listing/creative-storage";
import type { AdminGuardContext } from "@/lib/auth/admin-request-guard.server";
import {
  SupabasePrivateListingCreativeObjectStore,
  VercelPublicListingCreativeObjectStore,
} from "@/lib/listing/creative-object-stores.server";
import { createGuardedServiceRoleClient } from "@/lib/supabase/service-role.server";

export function createProductionManagedListingCreativeStorage(
  guardContext: AdminGuardContext,
): ManagedListingCreativeStorage {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (process.env.VERCEL_ENV !== "production" || !blobToken) {
    throw new CreativeStorageError("STORAGE_CONFIGURATION_UNAVAILABLE");
  }
  const privateStore = new SupabasePrivateListingCreativeObjectStore(
    createGuardedServiceRoleClient(guardContext),
  );
  const publicStore = new VercelPublicListingCreativeObjectStore(blobToken);
  return new ManagedListingCreativeStorage(privateStore, publicStore);
}
