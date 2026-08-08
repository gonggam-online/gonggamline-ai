import { createHash } from "node:crypto";

import {
  COUPANG_CATEGORY_SNAPSHOT_RULESET_VERSION,
  COUPANG_CATEGORY_SNAPSHOT_SCHEMA_VERSION,
  type CategorySnapshotIssue,
  type CategorySnapshotIssueCode,
  type CoupangCategoryAttribute,
  type CoupangCategorySnapshot,
  type CoupangCertification,
  type CoupangNoticeCategory,
  type CoupangRequiredDocument,
  type CoupangSalesChannel,
} from "@/shared/contracts/coupang-category-snapshot";

const SHA256 = /^[a-f0-9]{64}$/;
const MAX_COLLECTION = 100;
const MAX_NESTED_COLLECTION = 200;
const MAX_STRING = 200;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function canonicalize(value: JsonValue): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function toJsonValue(value: unknown): JsonValue | undefined {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) {
    const mapped = value.map(toJsonValue);
    return mapped.some((entry) => entry === undefined)
      ? undefined
      : mapped as JsonValue[];
  }
  if (value && typeof value === "object") {
    const output: { [key: string]: JsonValue } = {};
    for (const [key, entry] of Object.entries(value)) {
      const mapped = toJsonValue(entry);
      if (mapped === undefined) return undefined;
      output[key] = mapped;
    }
    return output;
  }
  return undefined;
}

export function digestCanonicalJson(value: unknown): string | null {
  const json = toJsonValue(value);
  return json === undefined
    ? null
    : createHash("sha256").update(canonicalize(json)).digest("hex");
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_STRING) return null;
  if (value !== value.normalize("NFC") || value.includes("\uFFFD")) return null;
  return value;
}

function enumValue<T extends string>(value: unknown, values: readonly T[]): T | null {
  return typeof value === "string" && values.includes(value as T) ? value as T : null;
}

function issue(issues: CategorySnapshotIssue[], code: CategorySnapshotIssueCode, path: string): void {
  issues.push({ code, path });
}

function boundedArray(value: unknown, path: string, issues: CategorySnapshotIssue[]): unknown[] {
  if (!Array.isArray(value)) {
    issue(issues, "MALFORMED_METADATA", path);
    return [];
  }
  if (value.length > MAX_COLLECTION) {
    issue(issues, "LIMIT_EXCEEDED", path);
    return [];
  }
  return value;
}

function parseStrings(value: unknown, path: string, issues: CategorySnapshotIssue[]): string[] {
  const values = boundedArray(value, path, issues);
  if (values.length > MAX_NESTED_COLLECTION) {
    issue(issues, "LIMIT_EXCEEDED", path);
    return [];
  }
  const output = values.map(text);
  if (output.some((entry) => entry === null)) {
    issue(issues, "INVALID_ENCODING", path);
    return [];
  }
  return output as string[];
}

function parseAttributes(value: unknown, issues: CategorySnapshotIssue[]): CoupangCategoryAttribute[] {
  return boundedArray(value, "metadata.data.attributes", issues).flatMap((entry, index) => {
    const item = record(entry);
    const name = text(item?.attributeTypeName);
    const required = enumValue(item?.required, ["MANDATORY", "OPTIONAL"] as const);
    const dataType = enumValue(item?.dataType, ["STRING", "NUMBER", "DATE"] as const);
    const basicUnit = text(item?.basicUnit);
    const inputType = item?.inputType === undefined
      ? null
      : enumValue(item.inputType, ["INPUT", "SELECT"] as const);
    const exposed = enumValue(item?.exposed, ["EXPOSED", "NONE"] as const);
    const groupNumber = text(item?.groupNumber);
    if (!item || !name || !required || !dataType || !basicUnit || !groupNumber || !exposed ||
      (item.inputType !== undefined && !inputType)) {
      issue(issues, "INVALID_ENUM", `metadata.data.attributes[${index}]`);
      return [];
    }
    return [{
      attributeTypeName: name,
      required,
      dataType,
      basicUnit,
      inputType,
      inputValues: parseStrings(item.inputValues ?? [], `metadata.data.attributes[${index}].inputValues`, issues),
      usableUnits: parseStrings(item.usableUnits ?? [], `metadata.data.attributes[${index}].usableUnits`, issues),
      groupNumber,
      exposed,
    }];
  });
}

function parseNotices(value: unknown, issues: CategorySnapshotIssue[]): CoupangNoticeCategory[] {
  return boundedArray(value, "metadata.data.noticeCategories", issues).flatMap((entry, index) => {
    const item = record(entry);
    const name = text(item?.noticeCategoryName);
    const details = boundedArray(
      item?.noticeCategoryDetailNames,
      `metadata.data.noticeCategories[${index}].noticeCategoryDetailNames`,
      issues,
    ).flatMap((detail, detailIndex) => {
      const candidate = record(detail);
      const detailName = text(candidate?.noticeCategoryDetailName);
      const required = enumValue(candidate?.required, ["MANDATORY", "OPTIONAL"] as const);
      if (!candidate || !detailName || !required) {
        issue(issues, "INVALID_ENUM", `metadata.data.noticeCategories[${index}].noticeCategoryDetailNames[${detailIndex}]`);
        return [];
      }
      return [{ noticeCategoryDetailName: detailName, required }];
    });
    if (!item || !name) {
      issue(issues, "MALFORMED_METADATA", `metadata.data.noticeCategories[${index}]`);
      return [];
    }
    return [{ noticeCategoryName: name, detailNames: details }];
  });
}

function parseDocuments(value: unknown, issues: CategorySnapshotIssue[]): CoupangRequiredDocument[] {
  return boundedArray(value, "metadata.data.requiredDocumentNames", issues).flatMap((entry, index) => {
    const item = record(entry);
    const templateName = text(item?.templateName);
    const required = text(item?.required);
    if (!item || !templateName || !required) {
      issue(issues, "MALFORMED_METADATA", `metadata.data.requiredDocumentNames[${index}]`);
      return [];
    }
    return [{ templateName, required }];
  });
}

function parseCertifications(value: unknown, issues: CategorySnapshotIssue[]): CoupangCertification[] {
  return boundedArray(value, "metadata.data.certifications", issues).flatMap((entry, index) => {
    const item = record(entry);
    const certificationType = text(item?.certificationType);
    const name = text(item?.name);
    const dataType = enumValue(item?.dataType, ["CODE", "NONE"] as const);
    const required = enumValue(item?.required, ["MANDATORY", "OPTIONAL", "RECOMMEND"] as const);
    if (!item || !certificationType || !name || !dataType || !required) {
      issue(issues, "INVALID_ENUM", `metadata.data.certifications[${index}]`);
      return [];
    }
    return [{ certificationType, name, dataType, required }];
  });
}

export function createCoupangCategorySnapshot(input: Readonly<{
  displayCategoryCode: string;
  channel: CoupangSalesChannel;
  observedAt: string;
  evaluatedAt: string;
  selectedNoticeCategoryName?: string | null;
  metadataResponse: unknown;
  validityResponse: unknown;
}>): CoupangCategorySnapshot {
  const issues: CategorySnapshotIssue[] = [];
  if (!/^\d+$/.test(input.displayCategoryCode) || Number(input.displayCategoryCode) <= 0) {
    issue(issues, "INVALID_CATEGORY_CODE", "displayCategoryCode");
  }
  const observedAt = Date.parse(input.observedAt);
  const evaluatedAt = Date.parse(input.evaluatedAt);
  if (!Number.isFinite(observedAt) || !Number.isFinite(evaluatedAt)) {
    issue(issues, "INVALID_OBSERVED_AT", "observedAt");
  } else if (evaluatedAt - observedAt > MAX_AGE_MS || observedAt > evaluatedAt) {
    issue(issues, "STALE_SNAPSHOT", "observedAt");
  }

  const metadataDigest = digestCanonicalJson(input.metadataResponse);
  const validityDigest = digestCanonicalJson(input.validityResponse);
  if (!metadataDigest || !SHA256.test(metadataDigest)) issue(issues, "MALFORMED_METADATA", "metadata");
  if (!validityDigest || !SHA256.test(validityDigest)) issue(issues, "MALFORMED_VALIDITY", "validity");

  const metadata = record(input.metadataResponse);
  const metadataData = record(metadata?.data);
  if (metadata?.code !== "SUCCESS" || !metadataData) issue(issues, "MALFORMED_METADATA", "metadata");
  const validity = record(input.validityResponse);
  const categoryValid = validity?.code === "SUCCESS" && typeof validity.data === "boolean"
    ? validity.data
    : false;
  if (validity?.code !== "SUCCESS" || typeof validity.data !== "boolean") {
    issue(issues, "MALFORMED_VALIDITY", "validity");
  } else if (!categoryValid) {
    issue(issues, "CATEGORY_NOT_VALID", "validity.data");
  }

  const attributes = parseAttributes(metadataData?.attributes, issues);
  const noticeCategories = parseNotices(metadataData?.noticeCategories, issues);
  const requiredDocuments = parseDocuments(metadataData?.requiredDocumentNames, issues);
  const certifications = parseCertifications(metadataData?.certifications, issues);
  const allowedOfferConditions = parseStrings(
    metadataData?.allowedOfferConditions,
    "metadata.data.allowedOfferConditions",
    issues,
  );
  const isAllowSingleItem = typeof metadataData?.isAllowSingleItem === "boolean"
    ? metadataData.isAllowSingleItem
    : null;
  if (isAllowSingleItem === null) issue(issues, "MALFORMED_METADATA", "metadata.data.isAllowSingleItem");

  const selectedNoticeCategoryName = input.selectedNoticeCategoryName ?? null;
  if (selectedNoticeCategoryName !== null &&
    !noticeCategories.some(({ noticeCategoryName }) => noticeCategoryName === selectedNoticeCategoryName)) {
    issue(issues, "NOTICE_CATEGORY_NOT_FOUND", "selectedNoticeCategoryName");
  }

  const uniqueIssues = [...new Map(issues.map((entry) => [`${entry.code}:${entry.path}`, entry])).values()]
    .sort((left, right) => `${left.path}:${left.code}`.localeCompare(`${right.path}:${right.code}`));
  return Object.freeze({
    schemaVersion: COUPANG_CATEGORY_SNAPSHOT_SCHEMA_VERSION,
    rulesetVersion: COUPANG_CATEGORY_SNAPSHOT_RULESET_VERSION,
    displayCategoryCode: input.displayCategoryCode,
    channel: input.channel,
    observedAt: input.observedAt,
    metadataDigest: metadataDigest ?? "",
    validityDigest: validityDigest ?? "",
    categoryValid,
    isAllowSingleItem,
    attributes: Object.freeze(attributes),
    noticeCategories: Object.freeze(noticeCategories),
    requiredDocuments: Object.freeze(requiredDocuments),
    certifications: Object.freeze(certifications),
    allowedOfferConditions: Object.freeze(allowedOfferConditions),
    selectedNoticeCategoryName,
    disposition: uniqueIssues.length === 0 ? "VALIDATED" : "QUARANTINED",
    issues: Object.freeze(uniqueIssues),
  });
}
