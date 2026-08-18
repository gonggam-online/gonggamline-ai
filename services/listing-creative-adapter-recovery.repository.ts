import "server-only";

import type { AdminGuardContext } from "@/lib/auth/admin-request-guard.server";
import { SupabasePrivateListingCreativeObjectStore } from "@/lib/listing/creative-object-stores.server";
import { createGuardedServiceRoleClient } from "@/lib/supabase/service-role.server";
import type {
  ListingCreativeAdapterPacket,
  ListingCreativeAdapterReadiness,
} from "@/shared/contracts/listing-creative-adapter-export";
import {
  loadListingCreativeAdapterPacket,
  persistListingCreativeAdapterPacket,
} from "@/services/listing-creative-adapter-recovery.service";

function store(context: AdminGuardContext): SupabasePrivateListingCreativeObjectStore {
  return new SupabasePrivateListingCreativeObjectStore(createGuardedServiceRoleClient(context));
}

export function persistOwnerAdapterPacket(
  context: AdminGuardContext,
  packet: ListingCreativeAdapterPacket,
  readiness: ListingCreativeAdapterReadiness,
  savedAt: string,
): Promise<{ packetDigest: string; path: string }> {
  return persistListingCreativeAdapterPacket(store(context), packet, readiness, savedAt);
}

export function loadOwnerAdapterPacket(
  context: AdminGuardContext,
  packetDigest: string,
) {
  return loadListingCreativeAdapterPacket(store(context), packetDigest);
}
