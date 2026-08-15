import assert from "node:assert/strict";
import { test } from "node:test";

import {
  parseListingCreativeAdapterReprepareRequest,
  reprepareListingCreativeAdapterPacket,
} from "../engines/listing/creative-adapter-reprepare.ts";
import { genericCommerceFields, genericListingInput } from "./fixtures/listing-content.ts";

function request() {
  const listingInput = genericListingInput();
  return {
    schemaVersion: "gonggamline-listing-creative-adapter-reprepare-v1" as const,
    revision: {
      packetId: listingInput.packetId,
      evaluationId: listingInput.evidence.evaluationId,
      evaluatedAt: listingInput.evidence.evaluatedAt,
      sourceReference: "fixture:current-wing-review:2026-08-15",
      reason: "CURRENT_WING_REVIEW" as const,
      contentApprovalReference: listingInput.contentApproval?.reviewerReference ?? "",
      liveWriteApprovalReference: genericCommerceFields().liveWriteApproval.approvalReference,
    },
    packet: { listingInput, commerce: genericCommerceFields() },
  };
}

test("re-prepare creates a new revision digest from current WING binding without persistence", () => {
  const parsed = parseListingCreativeAdapterReprepareRequest(request());
  const result = reprepareListingCreativeAdapterPacket(parsed.packet, parsed.revision, "2026-08-15T00:00:00.000Z");
  assert.match(result.revisionDigest, /^[a-f0-9]{64}$/);
  assert.equal(result.readiness.subjectId, "SYNTHETIC-PRODUCT-01");
  assert.equal(result.packet.listingInput.packetId, parsed.revision.packetId);
});

test("re-prepare rejects stale packet IDs and approval drift", () => {
  const value = request();
  assert.throws(
    () => reprepareListingCreativeAdapterPacket(value.packet, { ...value.revision, packetId: "stale-packet" }, "2026-08-15T00:00:00.000Z"),
    /ADAPTER_REPREPARE_REVISION_PACKET_MISMATCH/,
  );
  assert.throws(
    () => reprepareListingCreativeAdapterPacket(value.packet, { ...value.revision, contentApprovalReference: "wrong-owner" }, "2026-08-15T00:00:00.000Z"),
    /ADAPTER_REPREPARE_CONTENT_APPROVAL_MISMATCH/,
  );
});

test("re-prepare keeps live-write approval separate and fails closed when its reference disagrees", () => {
  const value = request();
  assert.throws(
    () => reprepareListingCreativeAdapterPacket(value.packet, { ...value.revision, liveWriteApprovalReference: "" }, "2026-08-15T00:00:00.000Z"),
    /ADAPTER_REPREPARE_LIVE_APPROVAL_MISMATCH/,
  );
});
