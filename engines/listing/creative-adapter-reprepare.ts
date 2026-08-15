import { digestCanonicalJson } from "@/engines/listing/category-snapshot";
import {
  evaluateListingCreativeAdapterPacket,
  parseListingCreativeAdapterPacket,
} from "@/engines/listing/creative-adapter-export";
import { liveWriteApprovalTargetDigest } from "@/engines/listing/live-write-approval";
import type {
  ListingCreativeAdapterPacket,
} from "@/shared/contracts/listing-creative-adapter-export";
import type {
  ListingCreativeAdapterRevisionMetadata,
  ListingCreativeAdapterReprepareResult,
} from "@/shared/contracts/listing-creative-adapter-reprepare";

const SHA256 = /^[a-f0-9]{64}$/;

function requiredString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`ADAPTER_REPREPARE_INVALID:${path}`);
  }
  return value;
}

function parseRevision(value: unknown): ListingCreativeAdapterRevisionMetadata {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("ADAPTER_REPREPARE_INVALID:revision");
  }
  const revision = value as Record<string, unknown>;
  const allowed = new Set([
    "packetId",
    "evaluationId",
    "evaluatedAt",
    "sourceReference",
    "reason",
    "contentApprovalReference",
    "liveWriteApprovalReference",
  ]);
  if (Object.keys(revision).some((key) => !allowed.has(key))) {
    throw new Error("ADAPTER_REPREPARE_UNKNOWN_KEY");
  }
  const reason = revision.reason;
  if (reason !== "CURRENT_WING_REVIEW" && reason !== "SOURCE_REFRESH" && reason !== "EXPIRED_PACKET_REPLACEMENT") {
    throw new Error("ADAPTER_REPREPARE_INVALID:revision.reason");
  }
  const liveWriteApprovalReference = revision.liveWriteApprovalReference;
  if (liveWriteApprovalReference !== null && typeof liveWriteApprovalReference !== "string") {
    throw new Error("ADAPTER_REPREPARE_INVALID:revision.liveWriteApprovalReference");
  }
  return Object.freeze({
    packetId: requiredString(revision.packetId, "revision.packetId"),
    evaluationId: requiredString(revision.evaluationId, "revision.evaluationId"),
    evaluatedAt: requiredString(revision.evaluatedAt, "revision.evaluatedAt"),
    sourceReference: requiredString(revision.sourceReference, "revision.sourceReference"),
    reason,
    contentApprovalReference: requiredString(revision.contentApprovalReference, "revision.contentApprovalReference"),
    liveWriteApprovalReference,
  });
}

export function parseListingCreativeAdapterReprepareRequest(value: unknown): Readonly<{
  revision: ListingCreativeAdapterRevisionMetadata;
  packet: ListingCreativeAdapterPacket;
}> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("ADAPTER_REPREPARE_INVALID_REQUEST");
  }
  const root = value as Record<string, unknown>;
  if (Object.keys(root).some((key) => key !== "schemaVersion" && key !== "revision" && key !== "packet")) {
    throw new Error("ADAPTER_REPREPARE_UNKNOWN_KEY");
  }
  if (root.schemaVersion !== "gonggamline-listing-creative-adapter-reprepare-v1") {
    throw new Error("ADAPTER_REPREPARE_INVALID_REQUEST");
  }
  return Object.freeze({
    revision: parseRevision(root.revision),
    packet: parseListingCreativeAdapterPacket(root.packet),
  });
}

function validateRevisionBinding(
  packet: ListingCreativeAdapterPacket,
  revision: ListingCreativeAdapterRevisionMetadata,
): void {
  if (packet.listingInput.packetId !== revision.packetId) {
    throw new Error("ADAPTER_REPREPARE_REVISION_PACKET_MISMATCH");
  }
  if (packet.listingInput.evidence.evaluationId !== revision.evaluationId) {
    throw new Error("ADAPTER_REPREPARE_REVISION_EVALUATION_MISMATCH");
  }
  if (packet.listingInput.evidence.evaluatedAt !== revision.evaluatedAt) {
    throw new Error("ADAPTER_REPREPARE_REVISION_TIMESTAMP_MISMATCH");
  }
  const contentApproval = packet.listingInput.contentApproval;
  if (!contentApproval || contentApproval.reviewerReference !== revision.contentApprovalReference) {
    throw new Error("ADAPTER_REPREPARE_CONTENT_APPROVAL_MISMATCH");
  }
  const liveApproval = packet.commerce.liveWriteApproval;
  if (liveApproval.approved !== Boolean(revision.liveWriteApprovalReference)) {
    throw new Error("ADAPTER_REPREPARE_LIVE_APPROVAL_MISMATCH");
  }
  if (liveApproval.approved && liveApproval.approvalReference !== revision.liveWriteApprovalReference) {
    throw new Error("ADAPTER_REPREPARE_LIVE_APPROVAL_MISMATCH");
  }
  if (liveApproval.approved && liveApproval.payloadDigest
    && liveApproval.payloadDigest !== liveWriteApprovalTargetDigest(packet)) {
    throw new Error("ADAPTER_REPREPARE_LIVE_APPROVAL_BINDING_MISMATCH");
  }
}

export function reprepareListingCreativeAdapterPacket(
  packet: ListingCreativeAdapterPacket,
  revision: ListingCreativeAdapterRevisionMetadata,
  generatedAt: string,
): ListingCreativeAdapterReprepareResult {
  validateRevisionBinding(packet, revision);
  const approvalExpiresAt = packet.commerce.liveWriteApproval.approvalExpiresAt;
  if (packet.commerce.liveWriteApproval.approved && approvalExpiresAt
    && Date.parse(approvalExpiresAt) <= Date.parse(generatedAt)) {
    throw new Error("ADAPTER_REPREPARE_LIVE_APPROVAL_EXPIRED");
  }
  const readiness = evaluateListingCreativeAdapterPacket(packet);
  const revisionDigest = digestCanonicalJson({ revision, packetDigest: readiness.packetDigest }) ?? "";
  if (!SHA256.test(revisionDigest)) throw new Error("ADAPTER_REPREPARE_DIGEST_FAILED");
  return Object.freeze({
    schemaVersion: "gonggamline-listing-creative-adapter-reprepare-v1",
    revision,
    revisionDigest,
    packet,
    readiness,
    generatedAt,
  });
}
