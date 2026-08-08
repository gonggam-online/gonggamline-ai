import { digestCanonicalJson } from "@/engines/listing/category-snapshot";
import type { CoupangCategorySnapshot } from "@/shared/contracts/coupang-category-snapshot";
import type { ListingEvidenceFact } from "@/shared/domain/listing-evidence";

const SHA256 = /^[a-f0-9]{64}$/;
const SAFE_REFERENCE = /^[A-Za-z0-9:._-]{1,200}$/;
const SNAPSHOT_VALIDITY_MS = 7 * 24 * 60 * 60 * 1000;

export type CategoryEvidenceBridgeIssueCode =
  | "SNAPSHOT_QUARANTINED"
  | "NOTICE_SELECTION_REQUIRED"
  | "INVALID_SNAPSHOT_DIGEST"
  | "INVALID_IDENTITY"
  | "STALE_SNAPSHOT";

export type CategoryEvidenceBridgeResult = Readonly<{
  disposition: "BRIDGED" | "QUARANTINED";
  evidenceFact: ListingEvidenceFact | null;
  issues: readonly CategoryEvidenceBridgeIssueCode[];
}>;

export function bridgeCategorySnapshotToEvidence(input: Readonly<{
  snapshot: CoupangCategorySnapshot;
  subjectId: string;
  catalogItemReference: string;
  capturedAt: string;
  evaluatedAt: string;
}>): CategoryEvidenceBridgeResult {
  const issues = new Set<CategoryEvidenceBridgeIssueCode>();
  const observedAt = Date.parse(input.snapshot.observedAt);
  const capturedAt = Date.parse(input.capturedAt);
  const evaluatedAt = Date.parse(input.evaluatedAt);

  if (input.snapshot.disposition !== "VALIDATED" || input.snapshot.issues.length > 0) {
    issues.add("SNAPSHOT_QUARANTINED");
  }
  if (!input.snapshot.selectedNoticeCategoryName) {
    issues.add("NOTICE_SELECTION_REQUIRED");
  }
  if (!SHA256.test(input.snapshot.metadataDigest) || !SHA256.test(input.snapshot.validityDigest)) {
    issues.add("INVALID_SNAPSHOT_DIGEST");
  }
  if (!SAFE_REFERENCE.test(input.subjectId) || !SAFE_REFERENCE.test(input.catalogItemReference)) {
    issues.add("INVALID_IDENTITY");
  }
  if (
    !Number.isFinite(observedAt) ||
    !Number.isFinite(capturedAt) ||
    !Number.isFinite(evaluatedAt) ||
    capturedAt < observedAt ||
    evaluatedAt < capturedAt ||
    evaluatedAt - observedAt > SNAPSHOT_VALIDITY_MS
  ) {
    issues.add("STALE_SNAPSHOT");
  }

  const snapshotDigest = digestCanonicalJson({
    schemaVersion: input.snapshot.schemaVersion,
    rulesetVersion: input.snapshot.rulesetVersion,
    displayCategoryCode: input.snapshot.displayCategoryCode,
    channel: input.snapshot.channel,
    observedAt: input.snapshot.observedAt,
    metadataDigest: input.snapshot.metadataDigest,
    validityDigest: input.snapshot.validityDigest,
    categoryValid: input.snapshot.categoryValid,
    selectedNoticeCategoryName: input.snapshot.selectedNoticeCategoryName,
    attributes: input.snapshot.attributes,
    noticeCategories: input.snapshot.noticeCategories,
    requiredDocuments: input.snapshot.requiredDocuments,
    certifications: input.snapshot.certifications,
    allowedOfferConditions: input.snapshot.allowedOfferConditions,
  });
  if (!snapshotDigest || !SHA256.test(snapshotDigest)) {
    issues.add("INVALID_SNAPSHOT_DIGEST");
  }

  const orderedIssues = [...issues].sort();
  if (orderedIssues.length > 0 || !snapshotDigest) {
    return Object.freeze({
      disposition: "QUARANTINED",
      evidenceFact: null,
      issues: Object.freeze(orderedIssues),
    });
  }

  const validUntil = new Date(observedAt + SNAPSHOT_VALIDITY_MS).toISOString();
  const evidenceFact: ListingEvidenceFact = Object.freeze({
    factId: `category-${snapshotDigest.slice(0, 24)}`,
    subjectId: input.subjectId,
    field: "coupangCategoryContract",
    factClass: "COUPANG_CATEGORY_REQUIREMENT",
    value: input.snapshot.displayCategoryCode,
    sourceType: "COUPANG_CATEGORY_METADATA",
    sourceReference: `coupang-category-snapshot:${snapshotDigest}`,
    evidenceDigest: snapshotDigest,
    observedAt: input.snapshot.observedAt,
    capturedAt: input.capturedAt,
    status: "PROVEN",
    scope: "CATALOG_ITEM",
    scopeReference: input.catalogItemReference,
    validUntil,
  });
  return Object.freeze({
    disposition: "BRIDGED",
    evidenceFact,
    issues: Object.freeze([]),
  });
}
