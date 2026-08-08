import { digestCanonicalJson } from "@/engines/listing/category-snapshot";
import {
  type CoupangProductPreflightResult,
  type MarketplacePreflightEvidence,
  type MarketplaceProductCreationIntent,
  type ProductPreflightIssue,
} from "@/shared/contracts/coupang-product-preflight";

const PLACEHOLDER = /(?:todo|tbd|unknown|placeholder|sample|example|임시|미정|확인\s*필요)/i;
const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{2,199}$/;
const MAX_VENDOR_EVIDENCE_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function add(
  issues: ProductPreflightIssue[],
  code: string,
  path: string,
  source: ProductPreflightIssue["source"],
): void {
  issues.push({ code, path, source });
}

function validText(value: string): boolean {
  return value.trim().length > 0 && value === value.normalize("NFC") &&
    !value.includes("\uFFFD") && !PLACEHOLDER.test(value);
}

function fingerprint(value: unknown): `sha256:${string}` {
  const digest = digestCanonicalJson(value);
  if (!digest) throw new TypeError("Preflight input must be canonical JSON");
  return `sha256:${digest}`;
}

export function preflightMarketplaceProductCreation(
  intent: MarketplaceProductCreationIntent,
  evidence: MarketplacePreflightEvidence,
  evaluatedAt: string,
): CoupangProductPreflightResult {
  const invalid: ProductPreflightIssue[] = [];
  const incomplete: ProductPreflightIssue[] = [];
  const category = evidence.categorySnapshot;

  if (intent.variant !== "MARKETPLACE") add(invalid, "UNSUPPORTED_VARIANT", "variant", "POLICY");
  if (intent.requested !== false) add(invalid, "APPROVAL_REQUEST_PROHIBITED", "requested", "POLICY");
  if (!SAFE_REF.test(intent.listingRevisionId)) add(invalid, "INVALID_REVISION_REF", "listingRevisionId", "INTENT");
  if (!SAFE_REF.test(intent.vendorRef) || !SAFE_REF.test(intent.wingUserRef)) {
    add(invalid, "INVALID_IDENTITY_REF", "vendorRef", "INTENT");
  } else if (intent.vendorRef === intent.wingUserRef) {
    add(invalid, "IDENTITY_REFS_NOT_DISTINCT", "wingUserRef", "POLICY");
  }
  if (intent.displayCategoryCode !== category.displayCategoryCode) {
    add(invalid, "CATEGORY_CODE_MISMATCH", "displayCategoryCode", "CATEGORY_METADATA");
  }
  if (category.channel !== "MARKETPLACE" || category.disposition !== "VALIDATED" || !category.categoryValid) {
    add(incomplete, "CATEGORY_EVIDENCE_NOT_VALIDATED", "evidence.categorySnapshot", "CATEGORY_METADATA");
  }

  const evaluated = Date.parse(evaluatedAt);
  const vendorObserved = Date.parse(evidence.vendor.observedAt);
  if (!Number.isFinite(evaluated) || !Number.isFinite(vendorObserved) || vendorObserved > evaluated ||
    evaluated - vendorObserved > MAX_VENDOR_EVIDENCE_AGE_MS) {
    add(incomplete, "VENDOR_EVIDENCE_STALE_OR_INVALID", "evidence.vendor.observedAt", "VENDOR_EVIDENCE");
  }
  if (evidence.vendor.vendorRef !== intent.vendorRef) {
    add(invalid, "VENDOR_REF_MISMATCH", "evidence.vendor.vendorRef", "VENDOR_EVIDENCE");
  }
  if (!evidence.vendor.outboundShippingPlaceCodes.includes(intent.outboundShippingPlaceCode)) {
    add(incomplete, "OUTBOUND_LOCATION_NOT_PROVEN", "outboundShippingPlaceCode", "VENDOR_EVIDENCE");
  }
  if (!evidence.vendor.returnCenterCodes.includes(intent.returnCenterCode)) {
    add(incomplete, "RETURN_CENTER_NOT_PROVEN", "returnCenterCode", "VENDOR_EVIDENCE");
  }

  for (const [field, value] of Object.entries({
    sellerProductName: intent.sellerProductName,
    displayProductName: intent.displayProductName,
    generalProductName: intent.generalProductName,
  })) {
    if (!validText(value)) add(invalid, "INVALID_OR_PLACEHOLDER_TEXT", field, "INTENT");
  }
  if (intent.items.length === 0) add(incomplete, "ITEM_REQUIRED", "items", "INTENT");

  const skus = new Set<string>();
  const optionTuples = new Set<string>();
  intent.items.forEach((item, itemIndex) => {
    const base = `items[${itemIndex}]`;
    if (!validText(item.externalVendorSku) || skus.has(item.externalVendorSku)) {
      add(invalid, "INVALID_OR_DUPLICATE_SKU", `${base}.externalVendorSku`, "INTENT");
    }
    skus.add(item.externalVendorSku);
    if (!validText(item.itemName)) add(invalid, "INVALID_OR_PLACEHOLDER_TEXT", `${base}.itemName`, "INTENT");

    const tuple = [...item.attributes]
      .filter(({ attributeTypeName }) => category.attributes.some((entry) =>
        entry.exposed === "EXPOSED" && entry.attributeTypeName === attributeTypeName))
      .map(({ attributeTypeName, attributeValueName }) => `${attributeTypeName}=${attributeValueName}`)
      .sort().join("|");
    if (tuple && optionTuples.has(tuple)) add(invalid, "DUPLICATE_EXPOSED_OPTION_TUPLE", `${base}.attributes`, "CATEGORY_METADATA");
    if (tuple) optionTuples.add(tuple);

    for (const required of category.attributes.filter(({ required }) => required === "MANDATORY")) {
      if (!item.attributes.some(({ attributeTypeName, attributeValueName }) =>
        attributeTypeName === required.attributeTypeName && validText(attributeValueName))) {
        add(incomplete, "MANDATORY_ATTRIBUTE_MISSING", `${base}.attributes.${required.attributeTypeName}`, "CATEGORY_METADATA");
      }
    }
    if (item.images.length === 0 || !item.images.some(({ imageOrder }) => imageOrder === 0)) {
      add(incomplete, "REPRESENTATION_IMAGE_MISSING", `${base}.images`, "INTENT");
    }
    const imageOrders = new Set<number>();
    item.images.forEach((image, imageIndex) => {
      if (!Number.isInteger(image.imageOrder) || image.imageOrder < 0 || imageOrders.has(image.imageOrder) ||
        !SAFE_REF.test(image.vendorPath) || PLACEHOLDER.test(image.vendorPath)) {
        add(invalid, "INVALID_IMAGE", `${base}.images[${imageIndex}]`, "INTENT");
      }
      imageOrders.add(image.imageOrder);
    });

    const selectedNotice = category.noticeCategories.find(({ noticeCategoryName }) =>
      noticeCategoryName === category.selectedNoticeCategoryName);
    if (!selectedNotice) add(incomplete, "NOTICE_DECISION_MISSING", `${base}.notices`, "CATEGORY_METADATA");
    for (const detail of selectedNotice?.detailNames.filter(({ required }) => required === "MANDATORY") ?? []) {
      if (!item.notices.some((notice) => notice.noticeCategoryName === selectedNotice?.noticeCategoryName &&
        notice.noticeCategoryDetailName === detail.noticeCategoryDetailName && validText(notice.content))) {
        add(incomplete, "MANDATORY_NOTICE_MISSING", `${base}.notices.${detail.noticeCategoryDetailName}`, "CATEGORY_METADATA");
      }
    }
    for (const certification of category.certifications.filter(({ required }) => required === "MANDATORY")) {
      if (!item.certifications.some((entry) => entry.certificationType === certification.certificationType &&
        (certification.dataType === "NONE" || validText(entry.certificationCode)))) {
        add(incomplete, "MANDATORY_CERTIFICATION_MISSING", `${base}.certifications.${certification.certificationType}`, "CATEGORY_METADATA");
      }
    }
    for (const document of category.requiredDocuments.filter(({ required }) => required === "MANDATORY")) {
      if (!item.requiredDocuments.some((entry) => entry.templateName === document.templateName &&
        SAFE_REF.test(entry.vendorPath) && !PLACEHOLDER.test(entry.vendorPath))) {
        add(incomplete, "MANDATORY_DOCUMENT_MISSING", `${base}.requiredDocuments.${document.templateName}`, "CATEGORY_METADATA");
      }
    }
  });

  const issues = [...invalid, ...incomplete].sort((left, right) =>
    `${left.path}:${left.code}`.localeCompare(`${right.path}:${right.code}`));
  return Object.freeze({
    status: invalid.length > 0 ? "INVALID" : incomplete.length > 0 ? "INCOMPLETE" : "READY",
    externalCallPerformed: false,
    coupangAcceptanceProven: false,
    variant: "MARKETPLACE",
    payloadFingerprint: fingerprint(intent),
    evidenceFingerprint: fingerprint(evidence),
    issues: Object.freeze(issues),
  });
}
