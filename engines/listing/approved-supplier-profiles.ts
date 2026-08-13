import { digestCanonicalJson } from "@/engines/listing/category-snapshot";
import type { ApprovedSupplierTrustProfile } from "@/shared/domain/supplier-trust";

const DOMEGGOOK_CAPABILITY = Object.freeze({
  profileId: "domeggook-approved-catalog",
  sourceId: "domeggook",
  version: "2026-08-13.owner-v1",
  status: "ACTIVE" as const,
  effectiveAt: "2026-08-13T00:00:00.000+09:00",
  supersedesVersion: null,
  allowedFactFields: Object.freeze(["productName", "modelName", "options", "color", "material", "dimensions", "components", "manufacturer", "origin", "catalogPrice", "minimumOrderQuantity", "availability"]),
  capabilities: Object.freeze({ publicProductFacts: true, accountProductFacts: true, transactionTerms: true, options: true, manufacturerAndOrigin: true }),
  originalImageUse: "VERIFIED" as const,
  imageEditRights: "UNKNOWN" as const,
  allowedChannels: Object.freeze(["COUPANG"]),
});

export const APPROVED_SUPPLIER_TRUST_PROFILES: readonly ApprovedSupplierTrustProfile[] = Object.freeze([
  Object.freeze({ ...DOMEGGOOK_CAPABILITY, capabilityDigest: digestCanonicalJson(DOMEGGOOK_CAPABILITY) ?? "" }),
]);

export function findApprovedSupplierTrustProfile(sourceId: string): ApprovedSupplierTrustProfile | null {
  return APPROVED_SUPPLIER_TRUST_PROFILES.find((profile) => profile.sourceId === sourceId && profile.status === "ACTIVE") ?? null;
}
