export const COUPANG_CATEGORY_SNAPSHOT_SCHEMA_VERSION =
  "gonggamline-coupang-category-snapshot-v1" as const;
export const COUPANG_CATEGORY_SNAPSHOT_RULESET_VERSION =
  "gonggamline-coupang-category-snapshot-rules-v1" as const;

export type CoupangSalesChannel = "MARKETPLACE" | "ROCKET_GROWTH";
export type CategoryRequirement = "MANDATORY" | "OPTIONAL" | "RECOMMEND";
export type CategorySnapshotDisposition = "VALIDATED" | "QUARANTINED";

export type CoupangCategoryAttribute = Readonly<{
  attributeTypeName: string;
  required: "MANDATORY" | "OPTIONAL";
  dataType: "STRING" | "NUMBER" | "DATE";
  basicUnit: string;
  inputType: "INPUT" | "SELECT" | null;
  inputValues: readonly string[];
  usableUnits: readonly string[];
  groupNumber: string;
  exposed: "EXPOSED" | "NONE";
}>;

export type CoupangNoticeCategory = Readonly<{
  noticeCategoryName: string;
  detailNames: readonly Readonly<{
    noticeCategoryDetailName: string;
    required: "MANDATORY" | "OPTIONAL";
  }>[];
}>;

export type CoupangRequiredDocument = Readonly<{
  templateName: string;
  required: string;
}>;

export type CoupangCertification = Readonly<{
  certificationType: string;
  name: string;
  dataType: "CODE" | "NONE";
  required: CategoryRequirement;
}>;

export type CategorySnapshotIssueCode =
  | "INVALID_CATEGORY_CODE"
  | "INVALID_OBSERVED_AT"
  | "STALE_SNAPSHOT"
  | "MALFORMED_METADATA"
  | "MALFORMED_VALIDITY"
  | "CATEGORY_NOT_VALID"
  | "LIMIT_EXCEEDED"
  | "INVALID_ENUM"
  | "INVALID_ENCODING"
  | "NOTICE_CATEGORY_NOT_FOUND";

export type CategorySnapshotIssue = Readonly<{
  code: CategorySnapshotIssueCode;
  path: string;
}>;

export type CoupangCategorySnapshot = Readonly<{
  schemaVersion: typeof COUPANG_CATEGORY_SNAPSHOT_SCHEMA_VERSION;
  rulesetVersion: typeof COUPANG_CATEGORY_SNAPSHOT_RULESET_VERSION;
  displayCategoryCode: string;
  channel: CoupangSalesChannel;
  observedAt: string;
  metadataDigest: string;
  validityDigest: string;
  categoryValid: boolean;
  isAllowSingleItem: boolean | null;
  attributes: readonly CoupangCategoryAttribute[];
  noticeCategories: readonly CoupangNoticeCategory[];
  requiredDocuments: readonly CoupangRequiredDocument[];
  certifications: readonly CoupangCertification[];
  allowedOfferConditions: readonly string[];
  selectedNoticeCategoryName: string | null;
  disposition: CategorySnapshotDisposition;
  issues: readonly CategorySnapshotIssue[];
}>;
