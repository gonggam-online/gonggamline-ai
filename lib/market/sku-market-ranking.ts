import { createHash } from "node:crypto";

import type { MarketOpportunity } from "./autonomous-intelligence";
import type { ExternalMarketSignalPacket } from "../../shared/contracts/external-market-signal-packet";

export const SKU_MARKET_RANKING_VERSION =
  "gonggamline-sku-market-ranking-v5" as const;

export type SkuMatchStatus =
  | "COUPANG_EXACT"
  | "EXACT_ID"
  | "BRAND_MODEL"
  | "TITLE_VARIANT"
  | "POSSIBLE_MATCH"
  | "NO_MATCH";

export type SkuMarketProduct = Readonly<{
  id: number;
  externalProductId: string;
  vendorItemId: string | null;
  title: string;
  source: string;
  url: string | null;
  brand: string | null;
  category: string | null;
  price: number | null;
  reviewCount: number | null;
  rank: number | null;
  rocketType: string | null;
  observedAt: string | null;
  opportunityScore: number | null;
  confidence: number | null;
  isSoldOut: boolean | null;
  estimatedUnitsLow: number | null;
  estimatedUnitsBase: number | null;
  estimatedUnitsHigh: number | null;
  stockoutCount30d: number | null;
  observationDays: number | null;
  snapshotCount: number | null;
  searchKeywords?: readonly string[];
}>;

export type SkuSupplierQuote = Readonly<{
  id: number;
  productName: string;
  supplierSku: string | null;
  unitCost: number;
  moq: number;
  domesticShippingTotal: number;
  inspectionTotal: number;
  packagingTotal: number;
  labelingTotal: number;
  threePlInboundTotal: number;
  threePlStoragePerUnit: number;
  threePlOutboundPerUnit: number;
  coupangFeeRate: number;
  expectedReturnRate: number;
  validUntil: string | null;
  status: string;
  updatedAt: string;
}>;

export type SkuMarketRanking = Readonly<{
  rank: number;
  skuKey: string;
  marketProductId: number;
  title: string;
  source: string;
  sourceUrl: string | null;
  coupangMatch: SkuMatchStatus;
  coupangProductId: string | null;
  score: number;
  confidence: number;
  concept: string;
  marketScore: number;
  productEvidenceScore: number;
  tiktokScore: number;
  economicsScore: number;
  priceKrw: number | null;
  reviewCount: number | null;
  availability: "IN_STOCK" | "SOLD_OUT" | "UNKNOWN";
  estimatedMonthlyUnits: number | null;
  estimatedMonthlyRevenueKrw: number | null;
  salesPerReview: number | null;
  revenuePerReviewKrw: number | null;
  demandEfficiencyScore: number;
  coupangOpportunityScore: number;
  salesStrengthScore: number;
  reviewHeadroomScore: number;
  trendProofScore: number;
  evidenceReliabilityScore: number;
  comparisonCohortSize: number;
  opportunityArchetype:
    "LOW_REVIEW_HIGH_SALES" | "PROVEN_DEMAND" | "INSUFFICIENT_DEMAND_EVIDENCE";
  supplierQuoteId: number | null;
  supplierQuoteFresh: boolean;
  supplierUnitCostKrw: number | null;
  supplierInboundCostKrw: number | null;
  inspectionPackagingCostKrw: number | null;
  threePlCostKrw: number | null;
  skuLogisticsCostKrw: number | null;
  landedUnitCostKrw: number | null;
  coupangFeeRate: number | null;
  coupangFeeKrw: number | null;
  returnAllowanceKrw: number | null;
  estimatedProfitKrw: number | null;
  estimatedMarginRate: number | null;
  profitabilityStatus:
    | "VERIFIED_QUOTE"
    | "MISSING_SUPPLIER_QUOTE"
    | "MISSING_MARKET_PRICE";
  relevantTikTokSignals: number;
  ignoredTikTokSignals: number;
  missingEvidence: readonly string[];
  reasons: readonly string[];
  qualification: "SELL_READY" | "HIGH_CONFIDENCE" | "VERIFY_NEXT";
  marketMatchScore: number;
  marketProviders: readonly string[];
  identityProviders: readonly string[];
  searchQueries: readonly string[];
}>;

export type SkuRankingPacket = Readonly<{
  version: typeof SKU_MARKET_RANKING_VERSION;
  asOf: string;
  rankings: readonly SkuMarketRanking[];
  recommendations: readonly SkuMarketRanking[];
  verificationQueue: readonly SkuMarketRanking[];
  discoveryQueries: readonly string[];
  audit: Readonly<{
    rawProductCandidates: number;
    excludedNonSkuProducts: number;
    deduplicatedSkuProducts: number;
    actualSkuProducts: number;
    highConfidenceProducts: number;
    recommendationProducts: number;
    sellReadyProducts: number;
    verificationQueueProducts: number;
    scheduledSearchQueries: number;
    exactCoupangMatches: number;
    relevantTikTokSignals: number;
    ignoredTikTokSignals: number;
    freshSupplierQuotes: number;
    skuLogisticsBindings: number;
    inStockProducts: number;
    soldOutProducts: number;
    unknownAvailabilityProducts: number;
    lowReviewHighSalesProducts: number;
  }>;
  digest: string;
}>;

const finite = (value: number | null | undefined, fallback = 0) =>
  Number.isFinite(value) ? Number(value) : fallback;
const clamp = (value: number) =>
  Math.round(Math.max(0, Math.min(100, value)) * 100) / 100;
const normalize = (value: string | null | undefined) =>
  (value ?? "")
    .normalize("NFC")
    .toLocaleLowerCase("ko-KR")
    .replace(/<[^>]*>/g, " ")
    .replace(/[^0-9a-z가-힣\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const compact = (value: string | null | undefined) =>
  normalize(value).replaceAll(" ", "");
const tokens = (value: string | null | undefined) =>
  new Set(
    normalize(value)
      .split(" ")
      .filter((token) => token.length >= 2),
  );
const digest = (value: unknown) =>
  createHash("sha256")
    .update(
      JSON.stringify(value, (_, entry) =>
        entry && typeof entry === "object" && !Array.isArray(entry)
          ? Object.fromEntries(
              Object.entries(entry).sort(([left], [right]) =>
                left.localeCompare(right),
              ),
            )
          : entry,
      ),
    )
    .digest("hex");

function percentile(
  value: number,
  population: readonly number[],
  higherIsBetter = true,
): number {
  if (!Number.isFinite(value) || population.length === 0) return 0;
  const sorted = [...population]
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  if (sorted.length === 0) return 0;
  if (sorted.length < 3) return 50;
  const lessOrEqual = sorted.filter((entry) => entry <= value).length;
  const raw = (lessOrEqual / sorted.length) * 100;
  return clamp(higherIsBetter ? raw : 100 - raw + 100 / sorted.length);
}

function median(values: readonly number[]): number | null {
  const sorted = [...values]
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

const GENERIC_SOCIAL = new Set([
  "챌린지",
  "challenge",
  "드라마",
  "가수",
  "아이돌",
  "music",
  "dance",
  "campaign",
  "캠페인",
  "챗지피티",
  "chatgpt",
]);
const GENERIC_PRODUCT = new Set([
  "상품",
  "제품",
  "추천",
  "인기",
  "신상",
  "정품",
  "무료배송",
  "국내배송",
  "판매",
  "구매",
  "사용",
  "리뷰",
]);
const VARIANT_TOKENS =
  /(?:black|white|red|blue|green|pink|beige|gray|grey|블랙|화이트|검정|흰색|빨강|파랑|그린|핑크|베이지|그레이|\d+\s*(?:개|입|세트|팩|매|ml|l|g|kg|cm|mm))/giu;
const NON_SKU_SOURCE =
  /(?:youtube|youtu\.be|tiktok|instagram|facebook|social[_ -]?content)/iu;

function sharedTokenRatio(left: string, right: string): number {
  const a = tokens(left);
  const b = tokens(right);
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return shared / Math.max(1, Math.min(a.size, b.size));
}

function variants(value: string): readonly string[] {
  return Object.freeze(
    [
      ...new Set((normalize(value).match(VARIANT_TOKENS) ?? []).map(compact)),
    ].sort(),
  );
}

function variantsCompatible(left: string, right: string): boolean {
  const a = variants(left);
  const b = variants(right);
  if (!a.length || !b.length) return true;
  return a.some((variant) => b.includes(variant));
}

function isCoupang(value: string | null | undefined): boolean {
  return /coupang/i.test(value ?? "") || normalize(value).includes("쿠팡");
}

function matchPacket(
  product: SkuMarketProduct,
  packet: ExternalMarketSignalPacket,
): SkuMatchStatus {
  const packetId = normalize(packet.platformProductId);
  if (
    packetId &&
    [product.externalProductId, product.vendorItemId].some(
      (id) => normalize(id) === packetId,
    )
  )
    return "EXACT_ID";
  const packetTitle = String(
    packet.productIdentity.title ?? packet.keywordId ?? "",
  );
  if (!variantsCompatible(product.title, packetTitle)) return "NO_MATCH";
  const productBrand = normalize(product.brand);
  const packetBrand = normalize(packet.productIdentity.brand);
  const model = normalize(packet.productIdentity.model);
  if (
    model &&
    compact(product.title).includes(compact(model)) &&
    (!productBrand || !packetBrand || productBrand === packetBrand)
  )
    return "BRAND_MODEL";
  const ratio = sharedTokenRatio(product.title, packetTitle);
  if (ratio >= 0.72) return "TITLE_VARIANT";
  if (ratio >= 0.45) return "POSSIBLE_MATCH";
  return "NO_MATCH";
}

function matchOpportunity(
  product: SkuMarketProduct,
  opportunities: readonly MarketOpportunity[],
): Readonly<{ opportunity: MarketOpportunity; score: number }> | null {
  const evidenceTexts = [
    product.title,
    product.category ?? "",
    ...(product.searchKeywords ?? []),
  ].filter(Boolean);
  return (
    [...opportunities]
      .map((opportunity) => {
        const compactConcept = compact(opportunity.concept);
        const ratio = Math.max(
          ...evidenceTexts.map((value) => {
            const compactValue = compact(value);
            if (
              compactConcept &&
              (compactValue.includes(compactConcept) ||
                compactConcept.includes(compactValue))
            )
              return 1;
            return sharedTokenRatio(value, opportunity.concept);
          }),
          0,
        );
        return { opportunity, score: clamp(ratio * 100) };
      })
      .filter(({ score }) => score > 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          b.opportunity.score - a.opportunity.score ||
          a.opportunity.concept.localeCompare(b.opportunity.concept, "ko"),
      )[0] ?? null
  );
}

function searchQueries(product: SkuMarketProduct): readonly string[] {
  const titleTokens = normalize(product.title)
    .split(" ")
    .filter(
      (token) =>
        token.length >= 2 &&
        token.length <= 20 &&
        !GENERIC_PRODUCT.has(token) &&
        !/^\d+$/.test(token),
    );
  const core = titleTokens.slice(0, 5);
  const queries = [
    core.slice(0, 4).join(" "),
    [normalize(product.brand), ...core.slice(0, 3)].filter(Boolean).join(" "),
    [normalize(product.category), ...core.slice(0, 2)]
      .filter(Boolean)
      .join(" "),
  ]
    .map((value) => value.trim())
    .filter((value) => value.length >= 2 && value.length <= 60);
  return Object.freeze([...new Set(queries)].slice(0, 3));
}

function opportunitySeedQueries(
  opportunities: readonly MarketOpportunity[],
): readonly string[] {
  return Object.freeze(
    [
      ...new Set(
        [...opportunities]
          .filter(
            (opportunity) =>
              opportunity.providers.length >= 2 && opportunity.confidence >= 55,
          )
          .sort(
            (left, right) =>
              right.score - left.score ||
              right.confidence - left.confidence ||
              left.concept.localeCompare(right.concept, "ko"),
          )
          .flatMap((opportunity) => {
            const concept = normalize(opportunity.concept);
            if (concept.length < 2 || concept.length > 40) return [];
            return [concept, `${concept} 인기상품`];
          }),
      ),
    ].slice(0, 6),
  );
}

function sameIdentity(
  left: SkuMarketProduct,
  right: SkuMarketProduct,
): boolean {
  if (
    [left.externalProductId, left.vendorItemId]
      .filter(Boolean)
      .some((id) =>
        [right.externalProductId, right.vendorItemId]
          .filter(Boolean)
          .map(normalize)
          .includes(normalize(id)),
      )
  )
    return true;
  if (!variantsCompatible(left.title, right.title)) return false;
  const leftBrand = normalize(left.brand);
  const rightBrand = normalize(right.brand);
  if (leftBrand && rightBrand && leftBrand !== rightBrand) return false;
  return sharedTokenRatio(left.title, right.title) >= 0.72;
}

function isFresh(product: SkuMarketProduct, asOf: string): boolean {
  const observed = Date.parse(product.observedAt ?? "");
  return (
    Number.isFinite(observed) && Date.parse(asOf) - observed <= 14 * 86_400_000
  );
}

function isActualSkuProduct(product: SkuMarketProduct): boolean {
  const provenance = normalize(
    `${product.source} ${product.brand ?? ""} ${product.externalProductId}`,
  );
  if (
    provenance.includes("demo") ||
    provenance.includes("공감데모") ||
    provenance.includes("synthetic")
  )
    return false;
  if (NON_SKU_SOURCE.test(`${product.source} ${product.url ?? ""}`))
    return false;
  if (!product.externalProductId || !product.title) return false;
  return Boolean(product.vendorItemId || product.url || product.source);
}

function canonicalSkuProducts(
  products: readonly SkuMarketProduct[],
): readonly SkuMarketProduct[] {
  const ordered = [...products].sort((left, right) => {
    const leftCoupang = isCoupang(left.source) || isCoupang(left.url) ? 1 : 0;
    const rightCoupang =
      isCoupang(right.source) || isCoupang(right.url) ? 1 : 0;
    const leftCompleteness = [
      left.price,
      left.reviewCount,
      left.rank,
      left.isSoldOut,
      left.estimatedUnitsBase,
    ].filter((value) => value !== null && value !== undefined).length;
    const rightCompleteness = [
      right.price,
      right.reviewCount,
      right.rank,
      right.isSoldOut,
      right.estimatedUnitsBase,
    ].filter((value) => value !== null && value !== undefined).length;
    return (
      rightCoupang - leftCoupang ||
      Date.parse(right.observedAt ?? "") - Date.parse(left.observedAt ?? "") ||
      rightCompleteness - leftCompleteness ||
      left.id - right.id
    );
  });
  const canonical: SkuMarketProduct[] = [];
  for (const product of ordered)
    if (!canonical.some((candidate) => sameIdentity(product, candidate)))
      canonical.push(product);
  return Object.freeze(canonical);
}

function absoluteReviewHeadroom(reviewCount: number): number {
  return clamp(
    100 - (Math.log10(Math.max(1, reviewCount + 1)) / Math.log10(5_001)) * 100,
  );
}

function relevantTikTok(
  product: SkuMarketProduct,
  packet: ExternalMarketSignalPacket,
  asOf: string,
): boolean {
  if (
    packet.source !== "TIKTOK" ||
    Date.parse(packet.validUntil) < Date.parse(asOf)
  )
    return false;
  const socialText = normalize(
    `${packet.keywordId} ${packet.productIdentity.title ?? ""}`,
  );
  if ([...GENERIC_SOCIAL].some((blocked) => socialText.includes(blocked)))
    return false;
  const match = matchPacket(product, packet);
  return (
    match === "EXACT_ID" || match === "BRAND_MODEL" || match === "TITLE_VARIANT"
  );
}

function quoteFor(
  product: SkuMarketProduct,
  quotes: readonly SkuSupplierQuote[],
  asOf: string,
): SkuSupplierQuote | null {
  const now = Date.parse(asOf);
  return (
    [...quotes]
      .filter((quote) => {
        if (!new Set(["received", "selected"]).has(quote.status)) return false;
        const fresh = quote.validUntil
          ? Date.parse(`${quote.validUntil}T23:59:59.999Z`) >= now
          : now - Date.parse(quote.updatedAt) <= 7 * 86_400_000;
        if (!fresh) return false;
        if (
          quote.supplierSku &&
          [product.externalProductId, product.vendorItemId].some(
            (id) => normalize(id) === normalize(quote.supplierSku),
          )
        )
          return true;
        return (
          sharedTokenRatio(product.title, quote.productName) >= 0.72 &&
          variantsCompatible(product.title, quote.productName)
        );
      })
      .sort(
        (a, b) =>
          (b.status === "selected" ? 1 : 0) -
            (a.status === "selected" ? 1 : 0) ||
          Date.parse(b.updatedAt) - Date.parse(a.updatedAt) ||
          a.id - b.id,
      )[0] ?? null
  );
}

function profitabilityBreakdown(
  quote: SkuSupplierQuote | null,
  price: number,
) {
  if (!quote)
    return {
      supplierUnitCostKrw: null,
      supplierInboundCostKrw: null,
      inspectionPackagingCostKrw: null,
      threePlCostKrw: null,
      skuLogisticsCostKrw: null,
      landedUnitCostKrw: null,
      coupangFeeRate: null,
      coupangFeeKrw: null,
      returnAllowanceKrw: null,
      estimatedProfitKrw: null,
      estimatedMarginRate: null,
      profitabilityStatus: "MISSING_SUPPLIER_QUOTE" as const,
    };
  const perUnit = (value: number) => value / Math.max(1, quote.moq);
  const supplierInboundCostKrw = perUnit(quote.domesticShippingTotal);
  const inspectionPackagingCostKrw = perUnit(
    quote.inspectionTotal + quote.packagingTotal + quote.labelingTotal,
  );
  const threePlCostKrw =
    perUnit(quote.threePlInboundTotal) +
    quote.threePlStoragePerUnit +
    quote.threePlOutboundPerUnit;
  const skuLogisticsCostKrw =
    Math.round(
      (supplierInboundCostKrw +
        inspectionPackagingCostKrw +
        threePlCostKrw) *
        100,
    ) / 100;
  const landedUnitCostKrw =
    Math.round((quote.unitCost + skuLogisticsCostKrw) * 100) / 100;
  if (price <= 0)
    return {
      supplierUnitCostKrw: quote.unitCost,
      supplierInboundCostKrw,
      inspectionPackagingCostKrw,
      threePlCostKrw,
      skuLogisticsCostKrw,
      landedUnitCostKrw,
      coupangFeeRate: quote.coupangFeeRate,
      coupangFeeKrw: null,
      returnAllowanceKrw: null,
      estimatedProfitKrw: null,
      estimatedMarginRate: null,
      profitabilityStatus: "MISSING_MARKET_PRICE" as const,
    };
  const coupangFeeKrw = (price * quote.coupangFeeRate) / 100;
  const returnAllowanceKrw =
    ((landedUnitCostKrw + skuLogisticsCostKrw * 0.5) *
      quote.expectedReturnRate) /
    100;
  const estimatedProfitKrw =
    Math.round(
      (price - landedUnitCostKrw - coupangFeeKrw - returnAllowanceKrw) * 100,
    ) / 100;
  return {
    supplierUnitCostKrw: quote.unitCost,
    supplierInboundCostKrw:
      Math.round(supplierInboundCostKrw * 100) / 100,
    inspectionPackagingCostKrw:
      Math.round(inspectionPackagingCostKrw * 100) / 100,
    threePlCostKrw: Math.round(threePlCostKrw * 100) / 100,
    skuLogisticsCostKrw,
    landedUnitCostKrw,
    coupangFeeRate: quote.coupangFeeRate,
    coupangFeeKrw: Math.round(coupangFeeKrw * 100) / 100,
    returnAllowanceKrw: Math.round(returnAllowanceKrw * 100) / 100,
    estimatedProfitKrw,
    estimatedMarginRate:
      Math.round(((estimatedProfitKrw / price) * 100) * 100) / 100,
    profitabilityStatus: "VERIFIED_QUOTE" as const,
  };
}

export function buildSkuMarketRankings(
  input: Readonly<{
    opportunities: readonly MarketOpportunity[];
    products: readonly SkuMarketProduct[];
    packets: readonly ExternalMarketSignalPacket[];
    quotes: readonly SkuSupplierQuote[];
    now?: Date;
    limit?: number;
  }>,
): SkuRankingPacket {
  const asOf = (input.now ?? new Date()).toISOString();
  const allActualProducts = input.products.filter(
    (product, index, all) =>
      isActualSkuProduct(product) &&
      all.findIndex(
        (candidate) =>
          `${candidate.source}:${candidate.externalProductId}` ===
          `${product.source}:${product.externalProductId}`,
      ) === index,
  );
  const actualProducts = canonicalSkuProducts(allActualProducts);
  const demandProducts = actualProducts.filter(
    (product) =>
      finite(product.estimatedUnitsBase) > 0 && finite(product.price) > 0,
  );
  const unitPopulation = demandProducts.map((product) =>
    finite(product.estimatedUnitsBase),
  );
  const revenuePopulation = demandProducts.map(
    (product) => finite(product.estimatedUnitsBase) * finite(product.price),
  );
  const reviewPopulation = demandProducts.map((product) =>
    Math.max(0, finite(product.reviewCount)),
  );
  const rankPopulation = demandProducts
    .map((product) => finite(product.rank))
    .filter((value) => value > 0);
  const salesPerReviewPopulation = demandProducts.map(
    (product) =>
      finite(product.estimatedUnitsBase) /
      Math.max(5, finite(product.reviewCount)),
  );
  const revenuePerReviewPopulation = demandProducts.map(
    (product) =>
      (finite(product.estimatedUnitsBase) * finite(product.price)) /
      Math.max(5, finite(product.reviewCount)),
  );
  const medianUnits = median(unitPopulation);
  const medianRevenue = median(revenuePopulation);
  const medianReviews = median(reviewPopulation);
  const evaluated = actualProducts
    .map((product) => {
      const opportunityMatch = matchOpportunity(product, input.opportunities);
      const opportunity = opportunityMatch?.opportunity ?? null;
      const marketMatchScore = opportunityMatch?.score ?? 0;
      const coupangExact = isCoupang(product.source) || isCoupang(product.url);
      const coupangPackets = input.packets.filter(
        (packet) =>
          packet.source === "COUPANG" || isCoupang(packet.upstreamSource),
      );
      const bestCoupang = coupangExact
        ? ("COUPANG_EXACT" as const)
        : (coupangPackets
            .map((packet) => matchPacket(product, packet))
            .sort(
              (a, b) =>
                [
                  "EXACT_ID",
                  "BRAND_MODEL",
                  "TITLE_VARIANT",
                  "POSSIBLE_MATCH",
                  "NO_MATCH",
                ].indexOf(a) -
                [
                  "EXACT_ID",
                  "BRAND_MODEL",
                  "TITLE_VARIANT",
                  "POSSIBLE_MATCH",
                  "NO_MATCH",
                ].indexOf(b),
            )[0] ?? "NO_MATCH");
      const relevant = input.packets.filter((packet) =>
        relevantTikTok(product, packet, asOf),
      );
      const allTikTok = input.packets.filter(
        (packet) => packet.source === "TIKTOK",
      );
      const tiktokScore = relevant.length
        ? clamp(
            relevant.reduce(
              (sum, packet) => sum + finite(packet.socialMomentum.score),
              0,
            ) / relevant.length,
          )
        : 0;
      const quote = quoteFor(product, input.quotes, asOf);
      const price = finite(product.price, 0);
      const profitability = profitabilityBreakdown(quote, price);
      const skuLogistics = profitability.skuLogisticsCostKrw;
      const estimatedUnits =
        finite(product.estimatedUnitsBase) > 0
          ? finite(product.estimatedUnitsBase)
          : null;
      const estimatedRevenue =
        estimatedUnits !== null && price > 0
          ? Math.round(estimatedUnits * price)
          : null;
      const reviews = Math.max(0, finite(product.reviewCount));
      const salesPerReview =
        estimatedUnits !== null
          ? Math.round((estimatedUnits / Math.max(1, reviews)) * 100) / 100
          : null;
      const revenuePerReview =
        estimatedRevenue !== null
          ? Math.round(estimatedRevenue / Math.max(1, reviews))
          : null;
      const salesPerReviewForScore =
        estimatedUnits !== null ? estimatedUnits / Math.max(5, reviews) : null;
      const revenuePerReviewForScore =
        estimatedRevenue !== null
          ? estimatedRevenue / Math.max(5, reviews)
          : null;
      const demandEfficiencyScore =
        salesPerReviewForScore !== null && revenuePerReviewForScore !== null
          ? clamp(
              percentile(salesPerReviewForScore, salesPerReviewPopulation) *
                0.5 +
                percentile(
                  revenuePerReviewForScore,
                  revenuePerReviewPopulation,
                ) *
                  0.5,
            )
          : 0;
      const salesStrengthScore =
        estimatedUnits !== null && estimatedRevenue !== null
          ? clamp(
              percentile(estimatedUnits, unitPopulation) * 0.45 +
                percentile(estimatedRevenue, revenuePopulation) * 0.35 +
                (finite(product.rank) > 0
                  ? percentile(finite(product.rank), rankPopulation, false) *
                    0.2
                  : 0),
            )
          : 0;
      const reviewHeadroomScore =
        estimatedUnits !== null
          ? clamp(
              percentile(reviews, reviewPopulation, false) * 0.6 +
                absoluteReviewHeadroom(reviews) * 0.4,
            )
          : 0;
      const trendProofScore = clamp(
        Math.min(50, (finite(product.observationDays) / 56) * 50) +
          Math.min(40, (finite(product.snapshotCount) / 16) * 40) +
          Math.min(10, (finite(product.stockoutCount30d) / 3) * 10),
      );
      const evidenceReliabilityScore = clamp(
        finite(product.confidence) * 0.65 + trendProofScore * 0.35,
      );
      const coupangOpportunityScore = clamp(
        salesStrengthScore * 0.32 +
          reviewHeadroomScore * 0.24 +
          demandEfficiencyScore * 0.24 +
          trendProofScore * 0.12 +
          evidenceReliabilityScore * 0.08,
      );
      const opportunityArchetype =
        estimatedUnits !== null && estimatedRevenue !== null
          ? medianReviews !== null &&
            medianUnits !== null &&
            medianRevenue !== null &&
            demandProducts.length >= 3 &&
            reviews <= medianReviews &&
            estimatedUnits >= medianUnits &&
            estimatedRevenue >= medianRevenue &&
            reviewHeadroomScore >= 55 &&
            demandEfficiencyScore >= 60 &&
            salesStrengthScore >= 60
            ? ("LOW_REVIEW_HIGH_SALES" as const)
            : ("PROVEN_DEMAND" as const)
          : ("INSUFFICIENT_DEMAND_EVIDENCE" as const);
      const availability =
        product.isSoldOut === false
          ? ("IN_STOCK" as const)
          : product.isSoldOut === true
            ? ("SOLD_OUT" as const)
            : ("UNKNOWN" as const);
      const estimatedProfit = profitability.estimatedProfitKrw;
      const economicsScore =
        estimatedProfit !== null && price > 0
          ? clamp((estimatedProfit / price) * 100)
          : 0;
      const productEvidenceScore = clamp(
        (price > 0 ? 20 : 0) +
          (reviews > 0 ? 15 : 0) +
          (finite(product.rank) > 0 ? 10 : 0) +
          (estimatedUnits !== null ? 20 : 0) +
          (availability === "IN_STOCK" ? 15 : 0) +
          (coupangExact
            ? 20
            : bestCoupang === "EXACT_ID"
              ? 18
              : bestCoupang === "BRAND_MODEL"
                ? 14
                : bestCoupang === "TITLE_VARIANT"
                  ? 10
                  : 0),
      );
      const identityProviders = [
        ...new Set(
          allActualProducts
            .filter((candidate) => sameIdentity(product, candidate))
            .map((candidate) => candidate.source),
        ),
      ].sort();
      const packetIdentityProviders = input.packets
        .filter((packet) =>
          new Set<SkuMatchStatus>([
            "EXACT_ID",
            "BRAND_MODEL",
            "TITLE_VARIANT",
          ]).has(matchPacket(product, packet)),
        )
        .flatMap((packet) => [packet.upstreamSource, packet.observedVia])
        .filter(Boolean);
      const corroboratingProviders = [
        ...new Set([...identityProviders, ...packetIdentityProviders]),
      ].sort();
      const marketProviders = opportunity?.providers ?? [];
      const fresh = isFresh(product, asOf);
      const identityScore =
        coupangExact || bestCoupang === "EXACT_ID"
          ? 100
          : bestCoupang === "BRAND_MODEL"
            ? 85
            : bestCoupang === "TITLE_VARIANT"
              ? 72
              : corroboratingProviders.length >= 2
                ? 68
                : bestCoupang === "POSSIBLE_MATCH"
                  ? 45
                  : 30;
      const missing = [
        ...(marketMatchScore < 45 ? ["MARKET_OPPORTUNITY_MATCH"] : []),
        ...(marketProviders.length < 2 ? ["INDEPENDENT_MARKET_SOURCES"] : []),
        ...(identityScore < 60 ? ["PRODUCT_IDENTITY_CORROBORATION"] : []),
        ...(corroboratingProviders.length < 2
          ? ["PRODUCT_LEVEL_CORROBORATION"]
          : []),
        ...(!fresh ? ["FRESH_PRODUCT_OBSERVATION"] : []),
        ...(availability === "SOLD_OUT"
          ? ["CURRENTLY_SOLD_OUT"]
          : availability === "UNKNOWN"
            ? ["CURRENT_AVAILABILITY"]
            : []),
        ...(estimatedUnits === null ? ["ESTIMATED_SALES_EVIDENCE"] : []),
        ...(estimatedRevenue === null ? ["ESTIMATED_REVENUE_EVIDENCE"] : []),
        ...(demandProducts.length < 3 ? ["COMPARABLE_COUPANG_COHORT"] : []),
        ...(trendProofScore < 35 ? ["TIME_SERIES_COVERAGE"] : []),
        ...(coupangOpportunityScore < 58 ? ["COUPANG_OPPORTUNITY_SCORE"] : []),
        ...(!coupangExact &&
        !new Set<SkuMatchStatus>([
          "EXACT_ID",
          "BRAND_MODEL",
          "TITLE_VARIANT",
        ]).has(bestCoupang)
          ? ["COUPANG_IDENTICAL_PRODUCT_MATCH"]
          : []),
        ...(!quote ? ["FRESH_SUPPLIER_QUOTE"] : []),
        ...(!skuLogistics ? ["SKU_LOGISTICS_COST"] : []),
        ...(price <= 0 ? ["CURRENT_MARKET_PRICE"] : []),
        ...(relevant.length === 0 ? ["PRODUCT_RELEVANT_TIKTOK_SIGNAL"] : []),
      ];
      const marketScore =
        opportunity?.score ?? finite(product.opportunityScore);
      const base =
        marketScore * 0.2 +
        productEvidenceScore * 0.12 +
        coupangOpportunityScore * 0.38 +
        tiktokScore * 0.03 +
        economicsScore * 0.17 +
        identityScore * 0.1;
      const freshnessScore = fresh ? 100 : 0;
      const confidence = clamp(
        (opportunity?.confidence ?? 0) * 0.45 +
          productEvidenceScore * 0.25 +
          identityScore * 0.2 +
          freshnessScore * 0.1,
      );
      const score = clamp(base * (0.72 + (confidence / 100) * 0.28));
      const marketQualified =
        marketMatchScore >= 45 &&
        marketProviders.length >= 2 &&
        identityScore >= 60 &&
        corroboratingProviders.length >= 2 &&
        fresh &&
        price > 0 &&
        availability === "IN_STOCK" &&
        estimatedUnits !== null &&
        estimatedRevenue !== null &&
        confidence >= 65 &&
        demandProducts.length >= 3 &&
        trendProofScore >= 35 &&
        coupangOpportunityScore >= 58;
      const qualification =
        marketQualified && quote && skuLogistics !== null
          ? "SELL_READY"
          : marketQualified
            ? "HIGH_CONFIDENCE"
            : "VERIFY_NEXT";
      const queries = searchQueries(product);
      return {
        rank: 0,
        skuKey: `${product.source}:${product.externalProductId}`,
        marketProductId: product.id,
        title: product.title,
        source: product.source,
        sourceUrl: product.url,
        coupangMatch: bestCoupang,
        coupangProductId: coupangExact ? product.externalProductId : null,
        score,
        confidence,
        concept: opportunity?.concept ?? "자동 교차검증 중",
        marketScore,
        productEvidenceScore,
        tiktokScore,
        economicsScore,
        priceKrw: product.price,
        reviewCount: product.reviewCount,
        availability,
        estimatedMonthlyUnits: estimatedUnits,
        estimatedMonthlyRevenueKrw: estimatedRevenue,
        salesPerReview,
        revenuePerReviewKrw: revenuePerReview,
        demandEfficiencyScore,
        coupangOpportunityScore,
        salesStrengthScore,
        reviewHeadroomScore,
        trendProofScore,
        evidenceReliabilityScore,
        comparisonCohortSize: demandProducts.length,
        opportunityArchetype,
        supplierQuoteId: quote?.id ?? null,
        supplierQuoteFresh: Boolean(quote),
        ...profitability,
        relevantTikTokSignals: relevant.length,
        ignoredTikTokSignals: Math.max(0, allTikTok.length - relevant.length),
        missingEvidence: Object.freeze(missing),
        reasons: Object.freeze([
          opportunity
            ? `${opportunity.concept} 교차매칭 ${Math.round(marketMatchScore)}`
            : "시장 상품군 자동 재탐색 필요",
          `쿠팡 판매기회 ${Math.round(coupangOpportunityScore)} · 수요 ${Math.round(salesStrengthScore)} · 리뷰여지 ${Math.round(reviewHeadroomScore)} · 효율 ${Math.round(demandEfficiencyScore)}`,
          `${corroboratingProviders.length}개 상품단위 출처 · 비교 SKU ${demandProducts.length}개`,
          opportunityArchetype === "LOW_REVIEW_HIGH_SALES"
            ? "동일 후보군 대비 리뷰는 적고 추정 판매량·매출은 높음"
            : estimatedUnits !== null
              ? `월 판매량 ${Math.round(estimatedUnits)}개 추정`
              : "판매량 근거 축적 필요",
          availability === "IN_STOCK"
            ? "현재 재고 있음"
            : availability === "SOLD_OUT"
              ? "현재 품절: 판매 후보에서 제외"
              : "현재 재고 상태 미확인",
          relevant.length
            ? `상품 관련 TikTok ${relevant.length}건`
            : "비상품 TikTok 신호 제외",
          quote ? `최신 견적 #${quote.id} 결합` : "최신 SKU 견적 미확보",
        ]),
        qualification,
        marketMatchScore,
        marketProviders: Object.freeze([...marketProviders]),
        identityProviders: Object.freeze(corroboratingProviders),
        searchQueries: queries,
      } satisfies SkuMarketRanking;
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.confidence - a.confidence ||
        a.skuKey.localeCompare(b.skuKey),
    );
  const limit = Math.max(1, Math.min(10, input.limit ?? 10));
  const rankings = evaluated
    .filter((item) => item.qualification !== "VERIFY_NEXT")
    .slice(0, limit)
    .map((item, index) => Object.freeze({ ...item, rank: index + 1 }));
  const recommendations = evaluated
    .filter(
      (item) =>
        item.availability !== "SOLD_OUT" &&
        Boolean(item.sourceUrl) &&
        (item.priceKrw ?? 0) > 0 &&
        item.confidence >= 35 &&
        item.productEvidenceScore >= 35 &&
        (item.marketMatchScore >= 25 ||
          item.coupangMatch === "COUPANG_EXACT" ||
          item.coupangMatch === "EXACT_ID"),
    )
    .slice(0, limit)
    .map((item, index) => Object.freeze({ ...item, rank: index + 1 }));
  const verificationQueue = evaluated
    .filter((item) => item.qualification === "VERIFY_NEXT")
    .slice(0, 10)
    .map((item, index) => Object.freeze({ ...item, rank: index + 1 }));
  // The first discovery cycle may legitimately have no persisted product rows yet.
  // Seed that cycle from the strongest cross-provider market opportunities; later
  // cycles replace these broad seeds with product-specific verification queries.
  const verificationQueries = verificationQueue.flatMap(
    (item) => item.searchQueries,
  );
  const seedQueries = opportunitySeedQueries(input.opportunities);
  const discoveryQueries = Object.freeze(
    [...new Set([...verificationQueries, ...seedQueries])].slice(0, 12),
  );
  const audit = Object.freeze({
    rawProductCandidates: input.products.length,
    excludedNonSkuProducts: Math.max(
      0,
      input.products.length - allActualProducts.length,
    ),
    deduplicatedSkuProducts: Math.max(
      0,
      allActualProducts.length - actualProducts.length,
    ),
    actualSkuProducts: actualProducts.length,
    highConfidenceProducts: rankings.length,
    recommendationProducts: recommendations.length,
    sellReadyProducts: rankings.filter(
      (item) => item.qualification === "SELL_READY",
    ).length,
    verificationQueueProducts: verificationQueue.length,
    scheduledSearchQueries: discoveryQueries.length,
    exactCoupangMatches: evaluated.filter(
      (item) =>
        item.coupangMatch === "COUPANG_EXACT" ||
        item.coupangMatch === "EXACT_ID",
    ).length,
    relevantTikTokSignals: evaluated.reduce(
      (sum, item) => sum + item.relevantTikTokSignals,
      0,
    ),
    ignoredTikTokSignals: evaluated.reduce(
      (sum, item) => sum + item.ignoredTikTokSignals,
      0,
    ),
    freshSupplierQuotes: evaluated.filter((item) => item.supplierQuoteFresh)
      .length,
    skuLogisticsBindings: evaluated.filter(
      (item) => item.skuLogisticsCostKrw !== null,
    ).length,
    inStockProducts: evaluated.filter(
      (item) => item.availability === "IN_STOCK",
    ).length,
    soldOutProducts: evaluated.filter(
      (item) => item.availability === "SOLD_OUT",
    ).length,
    unknownAvailabilityProducts: evaluated.filter(
      (item) => item.availability === "UNKNOWN",
    ).length,
    lowReviewHighSalesProducts: evaluated.filter(
      (item) => item.opportunityArchetype === "LOW_REVIEW_HIGH_SALES",
    ).length,
  });
  const payload = {
    version: SKU_MARKET_RANKING_VERSION,
    asOf,
    rankings,
    recommendations,
    verificationQueue,
    discoveryQueries,
    audit,
  } as const;
  return Object.freeze({ ...payload, digest: digest(payload) });
}
