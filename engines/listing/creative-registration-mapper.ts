import { digestCanonicalJson } from "@/engines/listing/category-snapshot";
import { mapApprovedCreativeCandidate } from "@/engines/listing/creative-approval";
import type { ListingContentPacket } from "@/shared/domain/listing-content";
import type { ListingCreativeReviewPacket } from "@/shared/domain/listing-creative";

const SHA256 = /^[a-f0-9]{64}$/;

export type CreativeRegistrationBinding = Readonly<{
  listingPacketId: string;
  creativePacketId: string;
  selectedVariantId: string;
  titleCandidateId: string;
  keywordCandidateId: string;
  titleDigest: string;
  keywordSetDigest: string;
  filterSetDigest: string;
  detailPackageDigest: string;
}>;

export type ApprovedCreativeRegistrationPayload = Readonly<{
  payload: Record<string, unknown>;
  payloadDigest: string;
  creativeApprovalDigest: string;
  selectedCandidateSetId: string;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function registrationItem(payload: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!payload || !Array.isArray(payload.items) || payload.items.length !== 1 || !isRecord(payload.items[0])) {
    return null;
  }
  return payload.items[0];
}

export function listingRegistrationFilterSetDigest(
  listing: ListingContentPacket,
): string | null {
  const item = registrationItem(listing.registrationPayload);
  if (!item || !Array.isArray(item.attributes)) return null;
  return digestCanonicalJson({ attributes: item.attributes });
}

export function listingCreativeRegistrationBinding(input: Readonly<{
  listing: ListingContentPacket;
  creative: ListingCreativeReviewPacket;
  titleCandidateId: string;
  keywordCandidateId: string;
  detailPackageDigest: string;
}>): CreativeRegistrationBinding {
  const filterSetDigest = listingRegistrationFilterSetDigest(input.listing);
  return Object.freeze({
    listingPacketId: input.listing.packetId,
    creativePacketId: input.creative.packetId,
    selectedVariantId: input.listing.selectedVariantId,
    titleCandidateId: input.titleCandidateId,
    keywordCandidateId: input.keywordCandidateId,
    titleDigest: digestCanonicalJson({ title: input.listing.title.value }) ?? "",
    keywordSetDigest: digestCanonicalJson({
      keywords: input.listing.keywords.map(({ text }) => text),
    }) ?? "",
    filterSetDigest: filterSetDigest ?? "",
    detailPackageDigest: input.detailPackageDigest,
  });
}

export function mapApprovedCreativeRegistrationPayload(input: Readonly<{
  listing: ListingContentPacket;
  creative: ListingCreativeReviewPacket;
  binding: CreativeRegistrationBinding;
}>): ApprovedCreativeRegistrationPayload | null {
  const approved = mapApprovedCreativeCandidate(input.creative);
  const selected = input.creative.candidates.find(({ candidateSetId }) =>
    candidateSetId === input.creative.selectedCandidateSetId);
  if (
    !approved
    || !selected
    || input.listing.status !== "REGISTRATION_READY"
    || !input.listing.registrationPayload
    || !input.listing.approval.contentApproved
    || !input.listing.approval.livePublishAuthorized
    || input.binding.listingPacketId !== input.listing.packetId
    || input.binding.creativePacketId !== input.creative.packetId
    || input.binding.selectedVariantId !== input.listing.selectedVariantId
    || input.binding.titleCandidateId !== selected.titleCandidateId
    || input.binding.keywordCandidateId !== selected.keywordCandidateId
    || input.binding.filterSetDigest !== selected.filterSetDigest
    || input.binding.filterSetDigest !== listingRegistrationFilterSetDigest(input.listing)
    || input.binding.detailPackageDigest !== selected.detailPackageDigest
    || input.binding.titleDigest !== digestCanonicalJson({ title: input.listing.title.value })
    || input.binding.keywordSetDigest !== digestCanonicalJson({
      keywords: input.listing.keywords.map(({ text }) => text),
    })
    || ![
      input.binding.titleDigest,
      input.binding.keywordSetDigest,
      input.binding.filterSetDigest,
      input.binding.detailPackageDigest,
    ].every((digest) => SHA256.test(digest))
  ) return null;

  const main = approved.artifacts.filter(({ role }) => role === "MAIN");
  const additional = approved.artifacts.filter(({ role }) => role === "ADDITIONAL");
  const detail = approved.artifacts.filter(({ role }) => role === "DETAIL");
  if (main.length !== 1 || additional.length > 9 || detail.length === 0) return null;
  const publicArtifacts = [...main, ...additional, ...detail];
  if (publicArtifacts.some(({ publicAssetReference }) =>
    !publicAssetReference
    || !/^https:\/\//.test(publicAssetReference)
    || /^(data:|supabase-storage:)/.test(publicAssetReference))) return null;

  const payload = structuredClone(input.listing.registrationPayload);
  const item = registrationItem(payload);
  if (!item) return null;
  const detailFigures = detail.map((artifact) =>
    `<figure style="margin:0;padding:20px"><img src="${escapeHtml(artifact.publicAssetReference ?? "")}" alt="${escapeHtml(artifact.altText)}" style="display:block;width:100%;height:auto" /></figure>`).join("");
  item.images = [...main, ...additional].map((artifact, imageOrder) => ({
    imageOrder,
    imageType: imageOrder === 0 ? "REPRESENTATION" : "DETAIL",
    vendorPath: artifact.publicAssetReference,
  }));
  item.contents = [{
    contentsType: "HTML",
    contentDetails: [{
      content: `${input.listing.detailPage.html}${detailFigures}`,
      detailType: "TEXT",
    }],
  }];
  const payloadDigest = digestCanonicalJson(payload);
  if (!payloadDigest) return null;
  return Object.freeze({
    payload,
    payloadDigest,
    creativeApprovalDigest: approved.approvalDigest,
    selectedCandidateSetId: approved.selectedCandidateSetId,
  });
}
