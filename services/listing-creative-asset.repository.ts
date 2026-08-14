import "server-only";

import {
  CreativeStorageError,
  ManagedListingCreativeStorage,
} from "@/engines/listing/creative-storage";
import type { AdminGuardContext } from "@/lib/auth/admin-request-guard.server";
import { resolveProductionListingCreativeBlobAuthentication } from "@/lib/listing/creative-blob-auth";
import {
  SupabasePrivateListingCreativeObjectStore,
  VercelPublicListingCreativeObjectStore,
} from "@/lib/listing/creative-object-stores.server";
import { createGuardedServiceRoleClient } from "@/lib/supabase/service-role.server";

export function createProductionManagedListingCreativeStorage(
  guardContext: AdminGuardContext,
): ManagedListingCreativeStorage {
  const blobAuthentication = resolveProductionListingCreativeBlobAuthentication({
    VERCEL_ENV: process.env.VERCEL_ENV,
    BLOB_STORE_ID: process.env.BLOB_STORE_ID,
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
  });
  if (!blobAuthentication) {
    throw new CreativeStorageError("STORAGE_CONFIGURATION_UNAVAILABLE");
  }
  const privateStore = new SupabasePrivateListingCreativeObjectStore(
    createGuardedServiceRoleClient(guardContext),
  );
  const publicStore = new VercelPublicListingCreativeObjectStore(blobAuthentication);
  return new ManagedListingCreativeStorage(privateStore, publicStore);
}
