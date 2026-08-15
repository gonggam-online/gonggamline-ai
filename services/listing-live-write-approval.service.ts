import "server-only";

import { buildListingLiveWriteApprovalRecord } from "@/engines/listing/live-write-approval";
import { SupabasePrivateListingCreativeObjectStore } from "@/lib/listing/creative-object-stores.server";
import { createGuardedServiceRoleClient } from "@/lib/supabase/service-role.server";
import type { AdminGuardContext } from "@/lib/auth/admin-request-guard.server";
import type { ListingCreativeAdapterPacket } from "@/shared/contracts/listing-creative-adapter-export";
import type { ListingLiveWriteApprovalRevisionBinding, ListingLiveWriteApprovalRecord } from "@/shared/domain/listing-live-write-approval";

const APPROVAL_PREFIX = "listing-creative/live-write-approval/v1";

function pathFor(approvalDigest: string): string {
  return `${APPROVAL_PREFIX}/${approvalDigest}.json`;
}

function encode(record: ListingLiveWriteApprovalRecord): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(record));
}

function parseStored(bytes: Uint8Array): ListingLiveWriteApprovalRecord {
  const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("LIVE_WRITE_APPROVAL_STORAGE_INVALID");
  }
  const record = parsed as Record<string, unknown>;
  if (record.schemaVersion !== "gonggamline-listing-live-write-approval-v1"
    || typeof record.approvalReference !== "string"
    || typeof record.approvalDigest !== "string"
    || typeof record.approvalTargetDigest !== "string"
    || typeof record.revisionBindingDigest !== "string") {
    throw new Error("LIVE_WRITE_APPROVAL_STORAGE_INVALID");
  }
  return record as unknown as ListingLiveWriteApprovalRecord;
}

export async function issueAndPersistListingLiveWriteApproval(
  guardContext: AdminGuardContext,
  input: Readonly<{
    packet: ListingCreativeAdapterPacket;
    revision: ListingLiveWriteApprovalRevisionBinding;
    issuedAt: string;
    expiresAt: string;
  }>,
): Promise<ListingLiveWriteApprovalRecord> {
  const record = buildListingLiveWriteApprovalRecord({
    ...input,
    actorReference: guardContext.administratorUserId,
  });
  const store = new SupabasePrivateListingCreativeObjectStore(
    createGuardedServiceRoleClient(guardContext),
  );
  const pathname = pathFor(record.approvalDigest);
  try {
    await store.putImmutable(pathname, encode(record), "application/json");
    return record;
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("IMMUTABLE_OBJECT_CONFLICT")) {
      throw error;
    }
    const existing = await store.read(pathname);
    if (!existing) throw new Error("LIVE_WRITE_APPROVAL_STORAGE_CONFLICT");
    const stored = parseStored(existing);
    if (stored.approvalDigest !== record.approvalDigest
      || stored.approvalTargetDigest !== record.approvalTargetDigest
      || stored.approvalReference !== record.approvalReference) {
      throw new Error("LIVE_WRITE_APPROVAL_STORAGE_CONFLICT");
    }
    return stored;
  }
}
