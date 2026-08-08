import type { CoupangCategorySnapshot } from "@/shared/contracts/coupang-category-snapshot";

export const COUPANG_PRODUCT_INTENT_SCHEMA_VERSION =
  "gonggamline-coupang-product-intent-v1" as const;

export type CoupangProductVariant = "MARKETPLACE" | "ROCKET_GROWTH" | "HYBRID";
export type ProductPreflightStatus = "INCOMPLETE" | "INVALID" | "READY";

export type ProductPreflightIssue = Readonly<{
  code: string;
  path: string;
  source: "INTENT" | "CATEGORY_METADATA" | "VENDOR_EVIDENCE" | "POLICY";
}>;

export type MarketplaceProductCreationIntent = Readonly<{
  schemaVersion: typeof COUPANG_PRODUCT_INTENT_SCHEMA_VERSION;
  variant: CoupangProductVariant;
  listingRevisionId: string;
  requested: false;
  vendorRef: string;
  wingUserRef: string;
  displayCategoryCode: string;
  sellerProductName: string;
  displayProductName: string;
  generalProductName: string;
  outboundShippingPlaceCode: string;
  returnCenterCode: string;
  items: readonly Readonly<{
    externalVendorSku: string;
    itemName: string;
    images: readonly Readonly<{ imageOrder: number; imageType: string; vendorPath: string }>[];
    attributes: readonly Readonly<{ attributeTypeName: string; attributeValueName: string }>[];
    notices: readonly Readonly<{
      noticeCategoryName: string;
      noticeCategoryDetailName: string;
      content: string;
    }>[];
    certifications: readonly Readonly<{
      certificationType: string;
      certificationCode: string;
    }>[];
    requiredDocuments: readonly Readonly<{ templateName: string; vendorPath: string }>[];
  }>[];
}>;

export type MarketplacePreflightEvidence = Readonly<{
  categorySnapshot: CoupangCategorySnapshot;
  vendor: Readonly<{
    observedAt: string;
    vendorRef: string;
    outboundShippingPlaceCodes: readonly string[];
    returnCenterCodes: readonly string[];
  }>;
}>;

export type CoupangProductPreflightResult = Readonly<{
  status: ProductPreflightStatus;
  externalCallPerformed: false;
  coupangAcceptanceProven: false;
  variant: "MARKETPLACE";
  payloadFingerprint: `sha256:${string}`;
  evidenceFingerprint: `sha256:${string}`;
  issues: readonly ProductPreflightIssue[];
}>;
