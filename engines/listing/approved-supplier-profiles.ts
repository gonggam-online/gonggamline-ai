import type { ApprovedSupplierTrustProfile } from "@/shared/domain/supplier-trust";

export const APPROVED_SUPPLIER_TRUST_PROFILES: readonly ApprovedSupplierTrustProfile[] = Object.freeze([
  Object.freeze({
    profileId: "domeggook-approved-catalog",
    sourceId: "domeggook",
    version: "2026-08-13.owner-v1",
    status: "ACTIVE",
    effectiveAt: "2026-08-13T00:00:00.000+09:00",
    allowedFactFields: Object.freeze(["productName", "modelName", "options", "manufacturer", "origin", "catalogPrice", "minimumOrderQuantity", "availability"]),
    originalImageUse: "VERIFIED",
    imageEditRights: "UNKNOWN",
    allowedChannels: Object.freeze(["COUPANG"]),
  }),
]);

export function findApprovedSupplierTrustProfile(sourceId: string): ApprovedSupplierTrustProfile | null {
  return APPROVED_SUPPLIER_TRUST_PROFILES.find((profile) => profile.sourceId === sourceId && profile.status === "ACTIVE") ?? null;
}
