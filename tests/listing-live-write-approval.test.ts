import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildListingLiveWriteApprovalRecord,
  liveWriteApprovalTargetDigest,
  normalizePacketForLiveWriteApproval,
  validateLiveWriteApprovalCandidate,
} from "../engines/listing/live-write-approval.ts";
import { genericCommerceFields, genericListingInput } from "./fixtures/listing-content.ts";

function candidate() {
  const listingInput = genericListingInput();
  const packet = {
    listingInput,
    commerce: { ...genericCommerceFields(), liveWriteApproval: { approved: false, approvalReference: "" } },
  } as const;
  const revision = {
    packetId: listingInput.packetId,
    evaluationId: listingInput.evidence.evaluationId,
    evaluatedAt: listingInput.evidence.evaluatedAt,
    sourceReference: "fixture:wing-review",
    contentApprovalReference: listingInput.contentApproval?.reviewerReference ?? "",
  } as const;
  return { packet, revision };
}

test("owner approval target digest excludes the approval field and is stable", () => {
  const { packet } = candidate();
  const first = liveWriteApprovalTargetDigest(packet);
  const second = liveWriteApprovalTargetDigest({
    ...packet,
    commerce: { ...packet.commerce, liveWriteApproval: { approved: false, approvalReference: "stale" } },
  });
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(first, second);
  assert.deepEqual(normalizePacketForLiveWriteApproval(packet).commerce.liveWriteApproval, { approved: false, approvalReference: "" });
});

test("owner approval is issued only when the live-write blocker is the remaining blocker", () => {
  const { packet, revision } = candidate();
  const targetDigest = validateLiveWriteApprovalCandidate(packet, revision);
  const record = buildListingLiveWriteApprovalRecord({
    packet,
    revision,
    actorReference: "00000000-0000-4000-8000-000000000001",
    issuedAt: "2026-08-15T00:00:00.000Z",
    expiresAt: "2026-08-16T00:00:00.000Z",
  });
  assert.equal(record.approvalTargetDigest, targetDigest);
  assert.match(record.approvalReference, /^owner-live-write:v1:[a-f0-9]{32}$/);
  assert.match(record.approvalDigest, /^[a-f0-9]{64}$/);
  assert.equal(record.scope, "COUPANG_WING_LIVE_WRITE");
});

test("owner approval remains blocked by payload failures but not by optional content approval", () => {
  const { packet, revision } = candidate();
  const listingWithoutApproval = Object.fromEntries(
    Object.entries(packet.listingInput).filter(([key]) => key !== "contentApproval"),
  ) as typeof packet.listingInput;
  const noContentApprovalRevision = { ...revision, contentApprovalReference: "" };
  assert.match(validateLiveWriteApprovalCandidate({ ...packet, listingInput: listingWithoutApproval }, noContentApprovalRevision), /^[a-f0-9]{64}$/);
  assert.throws(
    () => validateLiveWriteApprovalCandidate({
      ...packet,
      commerce: { ...packet.commerce, notices: [] },
    }, revision),
    /LIVE_WRITE_APPROVAL_NOT_ELIGIBLE/,
  );
});

test("an existing live approval cannot be re-issued", () => {
  const { packet, revision } = candidate();
  assert.throws(
    () => validateLiveWriteApprovalCandidate({
      ...packet,
      commerce: { ...packet.commerce, liveWriteApproval: { approved: true, approvalReference: "old" } },
    }, revision),
    /LIVE_WRITE_APPROVAL_ALREADY_PRESENT/,
  );
});
