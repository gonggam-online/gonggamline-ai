import { digestCanonicalJson } from "@/engines/listing/category-snapshot";
import { buildListingContentPacket } from "@/engines/listing/content-pipeline";
import type { ListingCreativeAdapterPacket } from "@/shared/contracts/listing-creative-adapter-export";
import {
  LISTING_LIVE_WRITE_APPROVAL_CONFIRMATION,
  LISTING_LIVE_WRITE_APPROVAL_VERSION,
  type ListingLiveWriteApprovalIssueInput,
  type ListingLiveWriteApprovalRecord,
  type ListingLiveWriteApprovalRevisionBinding,
} from "@/shared/domain/listing-live-write-approval";

const SHA256 = /^[a-f0-9]{64}$/;
const LIVE_WRITE_CODE = "LIVE_WRITE_APPROVAL_REQUIRED";

function requiredString(value: string, path: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`LIVE_WRITE_APPROVAL_INVALID:${path}`);
  }
  return value;
}

function digest(value: unknown, path: string): string {
  const result = digestCanonicalJson(value);
  if (!result || !SHA256.test(result)) {
    throw new Error(`LIVE_WRITE_APPROVAL_DIGEST_FAILED:${path}`);
  }
  return result;
}

export function normalizePacketForLiveWriteApproval(
  packet: ListingCreativeAdapterPacket,
): ListingCreativeAdapterPacket {
  return Object.freeze({
    listingInput: packet.listingInput,
    commerce: Object.freeze({
      ...packet.commerce,
      liveWriteApproval: Object.freeze({ approved: false, approvalReference: "" }),
    }),
  });
}

export function liveWriteApprovalTargetDigest(
  packet: ListingCreativeAdapterPacket,
): string {
  return digest(normalizePacketForLiveWriteApproval(packet), "target");
}

export function liveWriteApprovalRevisionDigest(
  revision: ListingLiveWriteApprovalRevisionBinding,
  targetDigest: string,
): string {
  return digest({
    version: LISTING_LIVE_WRITE_APPROVAL_VERSION,
    revision,
    targetDigest,
  }, "revision");
}

export function validateLiveWriteApprovalCandidate(
  packet: ListingCreativeAdapterPacket,
  revision: ListingLiveWriteApprovalRevisionBinding,
): string {
  if (packet.listingInput.packetId !== revision.packetId) {
    throw new Error("LIVE_WRITE_APPROVAL_PACKET_MISMATCH");
  }
  if (packet.listingInput.evidence.evaluationId !== revision.evaluationId) {
    throw new Error("LIVE_WRITE_APPROVAL_EVALUATION_MISMATCH");
  }
  if (packet.listingInput.evidence.evaluatedAt !== revision.evaluatedAt) {
    throw new Error("LIVE_WRITE_APPROVAL_TIMESTAMP_MISMATCH");
  }
  if (packet.listingInput.contentApproval?.reviewerReference !== revision.contentApprovalReference) {
    throw new Error("LIVE_WRITE_APPROVAL_CONTENT_MISMATCH");
  }
  if (packet.commerce.liveWriteApproval.approved || packet.commerce.liveWriteApproval.approvalReference.trim() !== "") {
    throw new Error("LIVE_WRITE_APPROVAL_ALREADY_PRESENT");
  }

  const content = buildListingContentPacket(packet.listingInput, packet.commerce);
  const blockers = content.issues.filter(({ severity }) => severity === "BLOCKER");
  const nonLiveBlockers = blockers.filter(({ code }) => code !== LIVE_WRITE_CODE);
  if (nonLiveBlockers.length > 0) {
    throw new Error("LIVE_WRITE_APPROVAL_NOT_ELIGIBLE");
  }
  if (blockers.every(({ code }) => code !== LIVE_WRITE_CODE)) {
    throw new Error("LIVE_WRITE_APPROVAL_ALREADY_SATISFIED");
  }
  return liveWriteApprovalTargetDigest(packet);
}

export function buildListingLiveWriteApprovalRecord(
  input: ListingLiveWriteApprovalIssueInput,
): ListingLiveWriteApprovalRecord {
  const targetDigest = validateLiveWriteApprovalCandidate(input.packet, input.revision);
  requiredString(input.actorReference, "actorReference");
  requiredString(input.issuedAt, "issuedAt");
  requiredString(input.expiresAt, "expiresAt");
  if (Date.parse(input.expiresAt) <= Date.parse(input.issuedAt)) {
    throw new Error("LIVE_WRITE_APPROVAL_EXPIRY_INVALID");
  }

  const revisionBindingDigest = liveWriteApprovalRevisionDigest(input.revision, targetDigest);
  const intentDigest = digest({
    version: LISTING_LIVE_WRITE_APPROVAL_VERSION,
    confirmation: LISTING_LIVE_WRITE_APPROVAL_CONFIRMATION,
    targetDigest,
    revisionBindingDigest,
  }, "intent");
  const approvalReference = `owner-live-write:v1:${intentDigest.slice(0, 32)}`;
  const base = {
    schemaVersion: LISTING_LIVE_WRITE_APPROVAL_VERSION,
    approvalReference,
    approvalTargetDigest: targetDigest,
    revisionBindingDigest,
    packetId: input.packet.listingInput.packetId,
    subjectId: input.packet.listingInput.subjectId,
    evaluationId: input.packet.listingInput.evidence.evaluationId,
    evaluatedAt: input.packet.listingInput.evidence.evaluatedAt,
    sourceReferenceDigest: digest(input.revision.sourceReference, "sourceReference"),
    contentApprovalReferenceDigest: digest(input.revision.contentApprovalReference, "contentApprovalReference"),
    actorReferenceDigest: digest(input.actorReference, "actorReference"),
    scope: "COUPANG_WING_LIVE_WRITE" as const,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
  };
  const approvalDigest = digest(base, "approval");
  return Object.freeze({ ...base, approvalDigest });
}
