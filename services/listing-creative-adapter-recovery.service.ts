import { digestCanonicalJson } from "@/engines/listing/category-snapshot";
import type { PrivateListingCreativeObjectStore } from "@/engines/listing/creative-storage";
import type {
  ListingCreativeAdapterPacket,
  ListingCreativeAdapterReadiness,
} from "@/shared/contracts/listing-creative-adapter-export";
import {
  LISTING_CREATIVE_ADAPTER_RECOVERY_SCHEMA,
  type ListingCreativeAdapterRecoveryRecord,
} from "@/shared/domain/listing-creative-adapter-recovery";

const PREFIX = "listing-creative/adapter-packets/v1";

function pathFor(packetDigest: string): string {
  if (!/^[a-f0-9]{64}$/.test(packetDigest)) throw new Error("ADAPTER_PACKET_DIGEST_FAILED");
  return `${PREFIX}/${packetDigest}.json`;
}

function encode(record: ListingCreativeAdapterRecoveryRecord): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(record));
}

function parse(value: unknown): ListingCreativeAdapterRecoveryRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("ADAPTER_PACKET_RECOVERY_INVALID");
  }
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== LISTING_CREATIVE_ADAPTER_RECOVERY_SCHEMA
    || typeof record.savedAt !== "string"
    || typeof record.packet !== "object"
    || typeof record.readiness !== "object") {
    throw new Error("ADAPTER_PACKET_RECOVERY_INVALID");
  }
  return record as unknown as ListingCreativeAdapterRecoveryRecord;
}

export function adapterPacketDigest(packet: ListingCreativeAdapterPacket): string {
  const digest = digestCanonicalJson(packet);
  if (!digest) throw new Error("ADAPTER_PACKET_DIGEST_FAILED");
  return digest;
}

export async function persistListingCreativeAdapterPacket(
  store: PrivateListingCreativeObjectStore,
  packet: ListingCreativeAdapterPacket,
  readiness: ListingCreativeAdapterReadiness,
  savedAt: string,
): Promise<{ packetDigest: string; path: string }> {
  const packetDigest = adapterPacketDigest(packet);
  if (readiness.packetDigest !== packetDigest) throw new Error("ADAPTER_PACKET_RECOVERY_DIGEST_MISMATCH");
  const record: ListingCreativeAdapterRecoveryRecord = Object.freeze({
    schemaVersion: LISTING_CREATIVE_ADAPTER_RECOVERY_SCHEMA,
    packet,
    readiness,
    savedAt,
  });
  const path = pathFor(packetDigest);
  try {
    await store.putImmutable(path, encode(record), "application/json");
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("IMMUTABLE_OBJECT_CONFLICT")) throw error;
    const existing = await store.read(path);
    if (!existing) throw new Error("ADAPTER_PACKET_RECOVERY_CONFLICT");
    const stored = parse(JSON.parse(new TextDecoder().decode(existing)) as unknown);
    if (stored.readiness.packetDigest !== packetDigest) throw new Error("ADAPTER_PACKET_RECOVERY_CONFLICT");
  }
  return { packetDigest, path };
}

export async function loadListingCreativeAdapterPacket(
  store: PrivateListingCreativeObjectStore,
  packetDigest: string,
): Promise<ListingCreativeAdapterRecoveryRecord | null> {
  const bytes = await store.read(pathFor(packetDigest));
  if (!bytes) return null;
  const record = parse(JSON.parse(new TextDecoder().decode(bytes)) as unknown);
  if (record.readiness.packetDigest !== packetDigest
    || adapterPacketDigest(record.packet) !== packetDigest) {
    throw new Error("ADAPTER_PACKET_RECOVERY_DIGEST_MISMATCH");
  }
  return record;
}
