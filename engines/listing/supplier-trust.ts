import type { ApprovedSupplierTrustProfile, TrustedSupplierAdmission, TrustedSupplierObservation } from "@/shared/domain/supplier-trust";

const MAX_WARNING_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function admitTrustedSupplierObservations(profile: ApprovedSupplierTrustProfile, observations: readonly TrustedSupplierObservation[], evaluatedAt: string): TrustedSupplierAdmission {
  const warnings: TrustedSupplierAdmission["warnings"][number][] = [];
  const evaluated = Date.parse(evaluatedAt);
  const active = profile.status === "ACTIVE";
  if (!active) warnings.push({ code: "TRUST_PROFILE_REVIEW_REQUIRED", path: "profile.status" });
  const facts = observations.flatMap((observation, index) => {
    if (observation.sourceId !== profile.sourceId || !profile.allowedFactFields.includes(observation.field)) {
      warnings.push({ code: "FIELD_OUTSIDE_CAPABILITY", path: `observations[${index}].field` });
      return [];
    }
    const observed = Date.parse(observation.observedAt);
    if (!Number.isFinite(observed) || !Number.isFinite(evaluated) || evaluated - observed > MAX_WARNING_AGE_MS) warnings.push({ code: "FRESHNESS_WARNING", path: `observations[${index}].observedAt` });
    return [{ factId: `trusted:${profile.profileId}:${observation.observationId}`, subjectId: observation.subjectId, field: observation.field, factClass: "CATALOG_CLAIM" as const, value: observation.value, sourceType: "SUPPLIER_CATALOG" as const, sourceReference: `${observation.sourceReference}#trust=${profile.version}`, evidenceDigest: observation.evidenceDigest, observedAt: observation.observedAt, capturedAt: observation.capturedAt, status: active ? "PROVEN" as const : "PROHIBITED" as const, scope: "CATALOG_ITEM" as const, scopeReference: `trusted:${profile.sourceId}:${observation.subjectId}`, reviewerReference: `trust-profile:${profile.profileId}:${profile.version}` }];
  });
  return { facts, warnings, profileVersion: profile.version };
}
