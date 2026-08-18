import assert from "node:assert/strict";
import { test } from "node:test";

import {
  evaluateListingCreativeAdapterPacket,
  parseListingCreativeAdapterPacket,
  sanitizeListingCreativeAdapterPacket,
} from "../engines/listing/creative-adapter-export.ts";
import { genericCommerceFields, genericListingInput } from "./fixtures/listing-content.ts";

function packet() {
  return { listingInput: genericListingInput(), commerce: genericCommerceFields() } as const;
}

test("adapter packet parser requires typed private commerce boundary fields", () => {
  assert.throws(
    () => parseListingCreativeAdapterPacket({
      ...packet(),
      commerce: { ...packet().commerce, returnCenterCode: "" },
    }),
    /ADAPTER_PACKET_INVALID:commerce\.returnCenterCode/,
  );
  assert.throws(
    () => parseListingCreativeAdapterPacket({ ...packet(), unexpected: true }),
    /ADAPTER_PACKET_UNKNOWN_KEY/,
  );
});

test("adapter evaluation returns a stable packet digest and readiness counts", () => {
  const parsed = parseListingCreativeAdapterPacket(packet());
  const readiness = evaluateListingCreativeAdapterPacket(parsed);
  assert.match(readiness.packetDigest, /^[a-f0-9]{64}$/);
  assert.equal(readiness.packetId, parsed.listingInput.packetId);
  assert.equal(readiness.subjectId, parsed.listingInput.subjectId);
  assert.ok(readiness.blockerCount >= 0);
});

test("adapter minimum gate does not require content or live-write approval", () => {
  const input = genericListingInput();
  const withoutContentApproval = Object.fromEntries(
    Object.entries(input).filter(([key]) => key !== "contentApproval"),
  ) as typeof input;
  const parsed = parseListingCreativeAdapterPacket({
    listingInput: withoutContentApproval,
    commerce: { ...genericCommerceFields(), liveWriteApproval: { approved: false, approvalReference: "" } },
  });
  const readiness = evaluateListingCreativeAdapterPacket(parsed);
  assert.equal(readiness.status, "REGISTRATION_READY");
  assert.equal(readiness.blockerCount, 0);
  assert.ok(readiness.warningCount > 0);
});

test("sanitized adapter review removes private refs without changing full packet", () => {
  const parsed = parseListingCreativeAdapterPacket(packet());
  const sanitized = sanitizeListingCreativeAdapterPacket(parsed);
  assert.notEqual(sanitized.commerce.vendorUserId, parsed.commerce.vendorUserId);
  assert.notEqual(sanitized.commerce.returnAddress, parsed.commerce.returnAddress);
  assert.equal(sanitized.commerce.salePrice, parsed.commerce.salePrice);
  assert.equal(sanitized.listingInput.packetId, parsed.listingInput.packetId);
  assert.ok(sanitized.commerce.vendorUserId.includes("REDACTED"));
});
