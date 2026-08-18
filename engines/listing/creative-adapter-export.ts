import { digestCanonicalJson } from "@/engines/listing/category-snapshot";
import { buildListingContentPacket } from "@/engines/listing/content-pipeline";
import type {
  ListingCreativeAdapterPacket,
  ListingCreativeAdapterReadiness,
} from "@/shared/contracts/listing-creative-adapter-export";
import type {
  ListingContentInput,
  RegistrationCommerceFields,
} from "@/shared/domain/listing-content";

const SHA256 = /^[a-f0-9]{64}$/;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredRecord(value: unknown, path: string): Record<string, unknown> {
  if (!record(value)) throw new Error(`ADAPTER_PACKET_INVALID:${path}`);
  return value;
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`ADAPTER_PACKET_INVALID:${path}`);
  }
  return value;
}

export function parseListingCreativeAdapterPacket(
  value: unknown,
  options: Readonly<{ allowUnresolvedLogistics?: boolean }> = {},
): ListingCreativeAdapterPacket {
  const root = requiredRecord(value, "packet");
  if (Object.keys(root).some((key) => key !== "listingInput" && key !== "commerce")) {
    throw new Error("ADAPTER_PACKET_UNKNOWN_KEY");
  }
  const listingInput = requiredRecord(root.listingInput, "listingInput");
  const commerce = requiredRecord(root.commerce, "commerce");
  requiredString(listingInput.packetId, "listingInput.packetId");
  requiredString(listingInput.subjectId, "listingInput.subjectId");
  requiredString(commerce.vendorUserId, "commerce.vendorUserId");
  if (options.allowUnresolvedLogistics) {
    if (typeof commerce.outboundShippingPlaceCode !== "string" || typeof commerce.returnCenterCode !== "string") {
      throw new Error("ADAPTER_PACKET_INVALID:commerce.logisticsCodes");
    }
  } else {
    requiredString(commerce.outboundShippingPlaceCode, "commerce.outboundShippingPlaceCode");
    requiredString(commerce.returnCenterCode, "commerce.returnCenterCode");
  }
  requiredString(commerce.returnZipCode, "commerce.returnZipCode");
  requiredString(commerce.returnAddress, "commerce.returnAddress");
  requiredString(commerce.returnAddressDetail, "commerce.returnAddressDetail");
  requiredString(commerce.companyContactNumber, "commerce.companyContactNumber");
  const packet = {
    listingInput: listingInput as unknown as ListingContentInput,
    commerce: commerce as unknown as RegistrationCommerceFields,
  } as const;
  return Object.freeze(packet);
}

export function evaluateListingCreativeAdapterPacket(
  packet: ListingCreativeAdapterPacket,
): ListingCreativeAdapterReadiness {
  const content = buildListingContentPacket(packet.listingInput, packet.commerce);
  const blockerCount = content.issues.filter(({ severity }) => severity === "BLOCKER").length;
  const warningCount = content.issues.filter(({ severity }) => severity === "WARNING").length;
  const optimizationPendingCount = content.issues.filter(({ severity }) => severity === "OPTIMIZATION_PENDING").length;
  const status = blockerCount > 0
    ? "REGISTRATION_BLOCKED"
    : content.status === "REGISTRATION_READY"
      ? "REGISTRATION_READY"
      : "OPTIMIZATION_PENDING";
  const packetDigest = digestCanonicalJson(packet) ?? "";
  if (!SHA256.test(packetDigest)) throw new Error("ADAPTER_PACKET_DIGEST_FAILED");
  return Object.freeze({
    status,
    blockerCount,
    warningCount,
    optimizationPendingCount,
    packetDigest,
    subjectId: packet.listingInput.subjectId,
    packetId: packet.listingInput.packetId,
  });
}

function redactText(value: string): string {
  return value.length === 0 ? "" : "[REDACTED]";
}

export function sanitizeListingCreativeAdapterPacket(
  packet: ListingCreativeAdapterPacket,
): ListingCreativeAdapterPacket {
  const listingInput = packet.listingInput;
  const commerce = packet.commerce;
  return Object.freeze({
    listingInput: Object.freeze({
      ...listingInput,
      sourceAssets: Object.freeze(listingInput.sourceAssets.map((asset) => Object.freeze({
        ...asset,
        sourceReference: redactText(asset.sourceReference),
        creatorReference: redactText(asset.creatorReference),
        rightsHolderReference: redactText(asset.rightsHolderReference),
      }))),
      assetRequests: Object.freeze(listingInput.assetRequests.map((asset) => Object.freeze({
        ...asset,
        outputReference: redactText(asset.outputReference),
        transformationReference: redactText(asset.transformationReference),
        outputRightsReference: redactText(asset.outputRightsReference),
      }))),
    }),
    commerce: Object.freeze({
      ...commerce,
      vendorUserId: redactText(commerce.vendorUserId),
      outboundShippingPlaceCode: redactText(commerce.outboundShippingPlaceCode),
      returnCenterCode: redactText(commerce.returnCenterCode),
      companyContactNumber: redactText(commerce.companyContactNumber),
      returnZipCode: redactText(commerce.returnZipCode),
      returnAddress: redactText(commerce.returnAddress),
      returnAddressDetail: redactText(commerce.returnAddressDetail),
    }),
  });
}
