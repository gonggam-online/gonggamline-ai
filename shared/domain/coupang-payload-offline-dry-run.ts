import { createHash } from "node:crypto";

import { validateCoupangProductPayload } from "@/lib/coupang/validator";
import {
  LISTING_GENERATOR_V2_PACKET_VERSION,
  type ListingGeneratorV2Packet,
} from "@/shared/domain/listing-generator-v2";
import type { CoupangProductPayload } from "@/types/coupang";

export const COUPANG_PAYLOAD_OFFLINE_DRY_RUN_VERSION =
  "gonggamline-coupang-payload-offline-dry-run-v1" as const;

type EvidenceState =
  | "APPROVED"
  | "VERIFIED"
  | "UNKNOWN"
  | "CONFLICT"
  | "PROHIBITED"
  | "REVOKED";

export type CoupangPayloadOfflineDryRunInput = Readonly<{
  packet: ListingGeneratorV2Packet;
  expectedPacketDigest: string;
  evaluatedAt: string;
  approval: Readonly<{
    state: "APPROVED" | "UNKNOWN" | "CONFLICT" | "REVOKED";
    packetDigest: string;
    approvedAt: string;
    validUntil: string;
    reviewerReference: string;
  }>;
  categoryEvidence: Readonly<{
    state: EvidenceState;
    categoryId: string;
    displayCategoryCode: number;
    digest: string;
    observedAt: string;
    validUntil: string;
  }>;
  policyEvidence: Readonly<{
    state: EvidenceState;
    digest: string;
    observedAt: string;
    validUntil: string;
  }>;
  rightsEvidence: readonly Readonly<{
    state: EvidenceState;
    creativeCandidateId: string;
    sourceAssetDigest: string;
    grantDigest: string;
    editOperation: string;
    checkedAt: string;
    validUntil: string;
  }>[];
  basePayload: CoupangProductPayload;
}>;

type QuarantineReason =
  | "PACKET_BINDING_MISMATCH"
  | "PACKET_NOT_APPROVED"
  | "APPROVAL_STALE"
  | "CATEGORY_NOT_APPROVED"
  | "CATEGORY_STALE"
  | "CATEGORY_BINDING_MISMATCH"
  | "POLICY_NOT_APPROVED"
  | "POLICY_STALE"
  | "POLICY_BINDING_MISMATCH"
  | "RIGHTS_NOT_VERIFIED"
  | "RIGHTS_STALE"
  | "RIGHTS_BINDING_MISMATCH"
  | "PAYLOAD_INVALID";

export type CoupangPayloadOfflineDryRunResult = Readonly<{
  version: typeof COUPANG_PAYLOAD_OFFLINE_DRY_RUN_VERSION;
  mode: "OFFLINE_DRY_RUN";
  externalCallPerformed: false;
  enqueued: false;
  submitted: false;
  packetVersion: typeof LISTING_GENERATOR_V2_PACKET_VERSION;
  packetDigest: string;
  status: "VALID" | "QUARANTINED";
  quarantineReasons: readonly QuarantineReason[];
  payload: CoupangProductPayload | null;
  payloadDigest: string | null;
}>;

const SHA256 = /^[a-f0-9]{64}$/;

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key.normalize("NFC"))}:${canonicalJson(item)}`)
    .join(",")}}`;
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function packetDigest(packet: ListingGeneratorV2Packet): string {
  const { digest: ignored, ...withoutDigest } = packet;
  void ignored;
  return digest(withoutDigest);
}

function isFresh(observedAt: string, validUntil: string, now: number): boolean {
  const observed = Date.parse(observedAt);
  const expires = Date.parse(validUntil);
  return Number.isFinite(observed) && Number.isFinite(expires) && observed <= now && expires >= now;
}

function quarantined(input: CoupangPayloadOfflineDryRunInput, reasons: readonly QuarantineReason[]): CoupangPayloadOfflineDryRunResult {
  return Object.freeze({
    version: COUPANG_PAYLOAD_OFFLINE_DRY_RUN_VERSION,
    mode: "OFFLINE_DRY_RUN",
    externalCallPerformed: false,
    enqueued: false,
    submitted: false,
    packetVersion: LISTING_GENERATOR_V2_PACKET_VERSION,
    packetDigest: input.packet.digest,
    status: "QUARANTINED",
    quarantineReasons: Object.freeze([...new Set(reasons)].sort()),
    payload: null,
    payloadDigest: null,
  });
}

/** Pure mapping only: no provider, queue, persistence, commerce, or network operation. */
export function mapApprovedListingPacketToCoupangOfflineDryRun(
  input: CoupangPayloadOfflineDryRunInput,
): CoupangPayloadOfflineDryRunResult {
  const reasons: QuarantineReason[] = [];
  const now = Date.parse(input.evaluatedAt);
  const packetBindingValid = SHA256.test(input.expectedPacketDigest)
    && input.packet.version === LISTING_GENERATOR_V2_PACKET_VERSION
    && input.packet.digest === input.expectedPacketDigest
    && packetDigest(input.packet) === input.expectedPacketDigest;
  if (!packetBindingValid) reasons.push("PACKET_BINDING_MISMATCH");

  if (input.approval.state !== "APPROVED") reasons.push("PACKET_NOT_APPROVED");
  if (input.approval.packetDigest !== input.expectedPacketDigest || !input.approval.reviewerReference.trim()) {
    reasons.push("PACKET_BINDING_MISMATCH");
  }
  if (!Number.isFinite(now) || !isFresh(input.approval.approvedAt, input.approval.validUntil, now)) reasons.push("APPROVAL_STALE");

  if (input.categoryEvidence.state !== "APPROVED" && input.categoryEvidence.state !== "VERIFIED") reasons.push("CATEGORY_NOT_APPROVED");
  if (!isFresh(input.categoryEvidence.observedAt, input.categoryEvidence.validUntil, now)) reasons.push("CATEGORY_STALE");
  if (input.categoryEvidence.categoryId !== input.packet.policyBinding.categoryId
      || input.categoryEvidence.digest !== input.packet.policyBinding.categoryEvidenceDigest
      || input.categoryEvidence.displayCategoryCode !== input.basePayload.displayCategoryCode) reasons.push("CATEGORY_BINDING_MISMATCH");

  if (input.policyEvidence.state !== "APPROVED" && input.policyEvidence.state !== "VERIFIED") reasons.push("POLICY_NOT_APPROVED");
  if (!isFresh(input.policyEvidence.observedAt, input.policyEvidence.validUntil, now)) reasons.push("POLICY_STALE");
  if (input.policyEvidence.digest !== input.packet.policyBinding.marketplacePolicyDigest) reasons.push("POLICY_BINDING_MISMATCH");

  for (const asset of input.packet.listingDraft.rightsClearedAssets) {
    const matchingRights = input.rightsEvidence.filter((candidate) => candidate.sourceAssetDigest === asset.sourceAssetDigest
      && candidate.grantDigest === asset.grantDigest
      && candidate.editOperation === asset.editOperation);
    if (matchingRights.length !== 1) {
      reasons.push("RIGHTS_BINDING_MISMATCH");
      continue;
    }
    const right = matchingRights[0];
    if (!right) throw new Error("Unreachable rights binding state.");
    if (right.state !== "VERIFIED") reasons.push("RIGHTS_NOT_VERIFIED");
    if (!isFresh(right.checkedAt, right.validUntil, now)) reasons.push("RIGHTS_STALE");
  }
  if (reasons.length > 0) return quarantined(input, reasons);

  const firstItem = input.basePayload.items[0];
  if (!firstItem) return quarantined(input, ["PAYLOAD_INVALID"]);
  const mappedPayload: CoupangProductPayload = {
    ...input.basePayload,
    sellerProductName: input.packet.listingDraft.title,
    displayProductName: input.packet.listingDraft.title,
    generalProductName: input.packet.listingDraft.title,
    items: input.basePayload.items.map((item, index) => ({
      ...item,
      images: index === 0
        ? input.packet.listingDraft.rightsClearedAssets.map((asset, imageOrder) => ({ imageOrder, imageType: imageOrder === 0 ? "REPRESENTATION" : "DETAIL", vendorPath: asset.reference }))
        : item.images,
      contents: index === 0
        ? [{ contentsType: "HTML", contentDetails: [{ content: input.packet.listingDraft.renderedDetailHtml, detailType: "TEXT" }] }]
        : item.contents,
    })),
  };
  if (validateCoupangProductPayload(mappedPayload).length > 0) return quarantined(input, ["PAYLOAD_INVALID"]);
  return Object.freeze({
    version: COUPANG_PAYLOAD_OFFLINE_DRY_RUN_VERSION,
    mode: "OFFLINE_DRY_RUN",
    externalCallPerformed: false,
    enqueued: false,
    submitted: false,
    packetVersion: input.packet.version,
    packetDigest: input.packet.digest,
    status: "VALID",
    quarantineReasons: Object.freeze([]),
    payload: Object.freeze(mappedPayload),
    payloadDigest: digest(mappedPayload),
  });
}
