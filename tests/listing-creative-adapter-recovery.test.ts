import assert from "node:assert/strict";
import { test } from "node:test";

import { evaluateListingCreativeAdapterPacket } from "../engines/listing/creative-adapter-export.ts";
import {
  adapterPacketDigest,
  loadListingCreativeAdapterPacket,
  persistListingCreativeAdapterPacket,
} from "../services/listing-creative-adapter-recovery.service.ts";
import { genericCommerceFields, genericListingInput } from "./fixtures/listing-content.ts";
import type { PrivateListingCreativeObjectStore, CreativeObjectLocation } from "../engines/listing/creative-storage.ts";
import type { ListingCreativeAdapterPacket } from "../shared/contracts/listing-creative-adapter-export.ts";

class MemoryStore implements PrivateListingCreativeObjectStore {
  readonly values = new Map<string, Uint8Array>();
  referenceFor(pathname: string): string { return `memory://${pathname}`; }
  async putImmutable(pathname: string, bytes: Uint8Array): Promise<CreativeObjectLocation> {
    if (this.values.has(pathname)) throw new Error("IMMUTABLE_OBJECT_CONFLICT");
    this.values.set(pathname, bytes.slice());
    return { pathname, reference: this.referenceFor(pathname) };
  }
  async read(pathname: string): Promise<Uint8Array | null> {
    const value = this.values.get(pathname);
    return value ? value.slice() : null;
  }
  async createSignedReviewUrl(pathname: string): Promise<string> { return this.referenceFor(pathname); }
}

function packet(): ListingCreativeAdapterPacket {
  return { listingInput: genericListingInput(), commerce: genericCommerceFields() };
}

test("adapter packets persist immutably and recover by digest without re-entry", async () => {
  const value = packet();
  const readiness = evaluateListingCreativeAdapterPacket(value);
  const store = new MemoryStore();
  const saved = await persistListingCreativeAdapterPacket(store, value, readiness, "2026-08-18T00:00:00.000Z");
  assert.equal(saved.packetDigest, adapterPacketDigest(value));
  const recovered = await loadListingCreativeAdapterPacket(store, saved.packetDigest);
  assert.deepEqual(recovered?.packet, value);
  assert.equal(recovered?.readiness.packetDigest, saved.packetDigest);
});

test("recovery rejects tampered stored packet bytes", async () => {
  const value = packet();
  const readiness = evaluateListingCreativeAdapterPacket(value);
  const store = new MemoryStore();
  const saved = await persistListingCreativeAdapterPacket(store, value, readiness, "2026-08-18T00:00:00.000Z");
  const bytes = store.values.get(`listing-creative/adapter-packets/v1/${saved.packetDigest}.json`);
  assert.ok(bytes);
  const parsed = JSON.parse(new TextDecoder().decode(bytes)) as { packet: ListingCreativeAdapterPacket };
  parsed.packet = { ...parsed.packet, commerce: { ...parsed.packet.commerce, vendorUserId: "tampered" } };
  store.values.set(`listing-creative/adapter-packets/v1/${saved.packetDigest}.json`, new TextEncoder().encode(JSON.stringify(parsed)));
  await assert.rejects(
    () => loadListingCreativeAdapterPacket(store, saved.packetDigest),
    /ADAPTER_PACKET_RECOVERY_DIGEST_MISMATCH/,
  );
});

test("a changed packet cannot reuse an old readiness digest", async () => {
  const first = packet();
  const readiness = evaluateListingCreativeAdapterPacket(first);
  const changed = { ...first, listingInput: { ...first.listingInput, packetId: `${first.listingInput.packetId}-new` } };
  await assert.rejects(
    () => persistListingCreativeAdapterPacket(new MemoryStore(), changed, readiness, "2026-08-18T00:00:00.000Z"),
    /ADAPTER_PACKET_RECOVERY_DIGEST_MISMATCH/,
  );
});
