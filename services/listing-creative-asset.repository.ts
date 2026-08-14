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
import type {
  CreativeObjectLocation,
  PublicListingCreativeObjectStore,
} from "@/engines/listing/creative-storage";
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

class PublicationDisabledListingCreativeObjectStore
implements PublicListingCreativeObjectStore {
  async putImmutable(): Promise<CreativeObjectLocation> {
    throw new CreativeStorageError("PUBLIC_MIRROR_NOT_APPROVED");
  }

  async read(): Promise<Uint8Array | null> {
    throw new CreativeStorageError("PUBLIC_MIRROR_NOT_APPROVED");
  }

  async remove(): Promise<void> {
    throw new CreativeStorageError("PUBLIC_MIRROR_NOT_APPROVED");
  }
}

export function createProductionManagedListingCreativePrivateStorage(
  guardContext: AdminGuardContext,
): ManagedListingCreativeStorage {
  if (process.env.VERCEL_ENV !== "production") {
    throw new CreativeStorageError("STORAGE_CONFIGURATION_UNAVAILABLE");
  }
  return new ManagedListingCreativeStorage(
    new SupabasePrivateListingCreativeObjectStore(
      createGuardedServiceRoleClient(guardContext),
    ),
    new PublicationDisabledListingCreativeObjectStore(),
  );
}
