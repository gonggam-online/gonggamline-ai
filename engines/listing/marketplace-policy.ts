import { digestCanonicalJson } from "@/engines/listing/category-snapshot";
import type { MarketplacePolicySnapshot, MarketplacePolicySource } from "@/shared/domain/listing-content";

const OBSERVED_AT = "2026-08-13T00:00:00.000+09:00";

function source(input: Omit<MarketplacePolicySource, "observedAt" | "version" | "digest"> & Readonly<{ version?: string }>): MarketplacePolicySource {
  const version = input.version ?? "observed-2026-08-13";
  return {
    ...input,
    observedAt: OBSERVED_AT,
    version,
    digest: digestCanonicalJson({ ...input, observedAt: OBSERVED_AT, version }) ?? "",
  };
}

export function createCoupangMarketplacePolicySnapshotV20260813(): MarketplacePolicySnapshot {
  const sources: readonly MarketplacePolicySource[] = [
    source({
      sourceId: "coupang-marketplace-listing-guide",
      kind: "COUPANG_OFFICIAL",
      priority: 1,
      url: "https://marketplace.coupang.com/mba/listing",
      appliesTo: "Marketplace category, option, main/additional image, detail preview, brand and search-filter guidance",
      limitation: "Public Seller Academy guidance can change; exact current WING category metadata and API validation take precedence.",
    }),
    source({
      sourceId: "coupang-marketplace-registration-guide",
      kind: "COUPANG_OFFICIAL",
      priority: 1,
      url: "https://marketplace.coupang.com/register?rf=MARKETPLACE",
      appliesTo: "WING registration sequence, notices, option/filter inputs and preview",
      limitation: "Descriptive public guide; it is not an acceptance response for a specific seller payload.",
    }),
    source({
      sourceId: "coupang-developer-keyword-faq",
      kind: "COUPANG_OFFICIAL",
      priority: 1,
      url: "https://developers.coupang.com/ko/faq/what-are-the-rules-for-search-keywords-for-product-listing",
      appliesTo: "At most 20 search keywords, at most 20 characters each, and the stated punctuation allowlist",
      limitation: "Observed FAQ; exact current provider validation remains authoritative.",
    }),
    source({
      sourceId: "coupang-marketplace-search-guide",
      kind: "COUPANG_OFFICIAL",
      priority: 1,
      url: "https://marketplace.coupang.com/information-center/blog-news6?rf=MARKETPLACE",
      appliesTo: "Relevant search terms, deduplication and avoidance of redundant combinations",
      limitation: "Optimization guidance, not measured seller conversion evidence.",
    }),
    source({
      sourceId: "coupang-marketplace-growth-guide",
      kind: "COUPANG_OFFICIAL",
      priority: 1,
      url: "https://marketplace.coupang.com/mba-onepage",
      appliesTo: "Organized detail information as a cold-start prior for reducing abandonment",
      limitation: "Promotional guidance with no guaranteed product-level effect size.",
    }),
    source({
      sourceId: "google-merchant-product-data-tips",
      kind: "COMMERCE_UX_RESEARCH",
      priority: 3,
      url: "https://support.google.com/merchants/answer/7380908?hl=en",
      appliesTo: "Customer journey, title front-loading, accurate matching data and professional non-promotional images",
      limitation: "Google ecosystem guidance; it is not Coupang policy or product-specific profit evidence.",
    }),
    source({
      sourceId: "baymard-product-image-text-research",
      kind: "COMMERCE_UX_RESEARCH",
      priority: 3,
      url: "https://baymard.com/blog/product-images-descriptive-text",
      appliesTo: "Image-first exploration, scale/context/feature visuals and skimmable supporting text",
      limitation: "Cross-site UX research; it does not establish a product-specific conversion or profit lift.",
    }),
  ];
  const policyWithoutDigest = {
    snapshotId: "coupang-marketplace-policy-2026-08-13",
    observedAt: OBSERVED_AT,
    titleMaxLength: 100,
    keywordMaxCount: 20,
    keywordMaxLength: 20,
    keywordAllowedPattern: "^[\\p{L}\\p{N}\\s!@#$%^&*+\\-;:'.]+$",
    mainImageMinimumPixels: 500,
    mainImageRecommendedPixels: 1000,
    additionalImageMaxCount: 9,
    allowedImageMimeTypes: ["image/jpeg", "image/png"],
    imageMaxByteSize: 10_000_000,
    forbiddenTerms: ["무료 100%", "무조건", "완치", "치료"],
    competitorMarks: [],
    prohibitedClaimPatterns: ["최고|유일|완벽|기적|100%\\s*(효과|보장)"],
    sources,
  } as const;
  return { ...policyWithoutDigest, digest: digestCanonicalJson(policyWithoutDigest) ?? "" };
}
