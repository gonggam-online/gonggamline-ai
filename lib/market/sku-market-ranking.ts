import { createHash } from "node:crypto";

import type { MarketOpportunity } from "./autonomous-intelligence";
import type { ExternalMarketSignalPacket } from "../../shared/contracts/external-market-signal-packet";

export const SKU_MARKET_RANKING_VERSION = "gonggamline-sku-market-ranking-v2" as const;

export type SkuMatchStatus = "COUPANG_EXACT" | "EXACT_ID" | "BRAND_MODEL" | "TITLE_VARIANT" | "POSSIBLE_MATCH" | "NO_MATCH";

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
  supplierQuoteId: number | null;
  supplierQuoteFresh: boolean;
  skuLogisticsCostKrw: number | null;
  estimatedProfitKrw: number | null;
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
  verificationQueue: readonly SkuMarketRanking[];
  discoveryQueries: readonly string[];
  audit: Readonly<{
    actualSkuProducts: number;
    highConfidenceProducts: number;
    sellReadyProducts: number;
    verificationQueueProducts: number;
    scheduledSearchQueries: number;
    exactCoupangMatches: number;
    relevantTikTokSignals: number;
    ignoredTikTokSignals: number;
    freshSupplierQuotes: number;
    skuLogisticsBindings: number;
  }>;
  digest: string;
}>;

const finite = (value: number | null | undefined, fallback = 0) => Number.isFinite(value) ? Number(value) : fallback;
const clamp = (value: number) => Math.round(Math.max(0, Math.min(100, value)) * 100) / 100;
const normalize = (value: string | null | undefined) => (value ?? "").normalize("NFC").toLocaleLowerCase("ko-KR")
  .replace(/<[^>]*>/g, " ").replace(/[^0-9a-z가-힣\s]/g, " ").replace(/\s+/g, " ").trim();
const compact = (value: string | null | undefined) => normalize(value).replaceAll(" ", "");
const tokens = (value: string | null | undefined) => new Set(normalize(value).split(" ").filter((token) => token.length >= 2));
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value, (_, entry) => entry && typeof entry === "object" && !Array.isArray(entry)
  ? Object.fromEntries(Object.entries(entry).sort(([left], [right]) => left.localeCompare(right))) : entry)).digest("hex");

const GENERIC_SOCIAL = new Set(["챌린지", "challenge", "드라마", "가수", "아이돌", "music", "dance", "campaign", "캠페인", "챗지피티", "chatgpt"]);
const GENERIC_PRODUCT = new Set(["상품", "제품", "추천", "인기", "신상", "정품", "무료배송", "국내배송", "판매", "구매", "사용", "리뷰"]);
const VARIANT_TOKENS = /(?:black|white|red|blue|green|pink|beige|gray|grey|블랙|화이트|검정|흰색|빨강|파랑|그린|핑크|베이지|그레이|\d+\s*(?:개|입|세트|팩|매|ml|l|g|kg|cm|mm))/giu;

function sharedTokenRatio(left: string, right: string): number {
  const a = tokens(left); const b = tokens(right);
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return shared / Math.max(1, Math.min(a.size, b.size));
}

function variants(value: string): readonly string[] {
  return Object.freeze([...new Set((normalize(value).match(VARIANT_TOKENS) ?? []).map(compact))].sort());
}

function variantsCompatible(left: string, right: string): boolean {
  const a = variants(left); const b = variants(right);
  if (!a.length || !b.length) return true;
  return a.some((variant) => b.includes(variant));
}

function isCoupang(value: string | null | undefined): boolean {
  return /coupang/i.test(value ?? "") || normalize(value).includes("쿠팡");
}

function matchPacket(product: SkuMarketProduct, packet: ExternalMarketSignalPacket): SkuMatchStatus {
  const packetId = normalize(packet.platformProductId);
  if (packetId && [product.externalProductId, product.vendorItemId].some((id) => normalize(id) === packetId)) return "EXACT_ID";
  const packetTitle = String(packet.productIdentity.title ?? packet.keywordId ?? "");
  if (!variantsCompatible(product.title, packetTitle)) return "NO_MATCH";
  const productBrand = normalize(product.brand);
  const packetBrand = normalize(packet.productIdentity.brand);
  const model = normalize(packet.productIdentity.model);
  if (model && compact(product.title).includes(compact(model)) && (!productBrand || !packetBrand || productBrand === packetBrand)) return "BRAND_MODEL";
  const ratio = sharedTokenRatio(product.title, packetTitle);
  if (ratio >= .72) return "TITLE_VARIANT";
  if (ratio >= .45) return "POSSIBLE_MATCH";
  return "NO_MATCH";
}

function matchOpportunity(product: SkuMarketProduct, opportunities: readonly MarketOpportunity[]): Readonly<{ opportunity: MarketOpportunity; score: number }> | null {
  const evidenceTexts = [product.title, product.category ?? "", ...(product.searchKeywords ?? [])].filter(Boolean);
  return [...opportunities].map((opportunity) => {
    const compactConcept = compact(opportunity.concept);
    const ratio = Math.max(...evidenceTexts.map((value) => {
      const compactValue = compact(value);
      if (compactConcept && (compactValue.includes(compactConcept) || compactConcept.includes(compactValue))) return 1;
      return sharedTokenRatio(value, opportunity.concept);
    }), 0);
    return { opportunity, score: clamp(ratio * 100) };
  }).filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.opportunity.score - a.opportunity.score || a.opportunity.concept.localeCompare(b.opportunity.concept, "ko"))[0] ?? null;
}

function searchQueries(product: SkuMarketProduct): readonly string[] {
  const titleTokens = normalize(product.title).split(" ").filter((token) => token.length >= 2 && token.length <= 20 && !GENERIC_PRODUCT.has(token) && !/^\d+$/.test(token));
  const core = titleTokens.slice(0, 5);
  const queries = [
    core.slice(0, 4).join(" "),
    [normalize(product.brand), ...core.slice(0, 3)].filter(Boolean).join(" "),
    [normalize(product.category), ...core.slice(0, 2)].filter(Boolean).join(" "),
  ].map((value) => value.trim()).filter((value) => value.length >= 2 && value.length <= 60);
  return Object.freeze([...new Set(queries)].slice(0, 3));
}

function sameIdentity(left: SkuMarketProduct, right: SkuMarketProduct): boolean {
  if ([left.externalProductId, left.vendorItemId].filter(Boolean).some((id) => [right.externalProductId, right.vendorItemId].filter(Boolean).map(normalize).includes(normalize(id)))) return true;
  if (!variantsCompatible(left.title, right.title)) return false;
  const leftBrand = normalize(left.brand); const rightBrand = normalize(right.brand);
  if (leftBrand && rightBrand && leftBrand !== rightBrand) return false;
  return sharedTokenRatio(left.title, right.title) >= .72;
}

function isFresh(product: SkuMarketProduct, asOf: string): boolean {
  const observed = Date.parse(product.observedAt ?? "");
  return Number.isFinite(observed) && Date.parse(asOf) - observed <= 14 * 86_400_000;
}

function relevantTikTok(product: SkuMarketProduct, packet: ExternalMarketSignalPacket, asOf: string): boolean {
  if (packet.source !== "TIKTOK" || Date.parse(packet.validUntil) < Date.parse(asOf)) return false;
  const socialText = normalize(`${packet.keywordId} ${packet.productIdentity.title ?? ""}`);
  if ([...GENERIC_SOCIAL].some((blocked) => socialText.includes(blocked))) return false;
  const match = matchPacket(product, packet);
  return match === "EXACT_ID" || match === "BRAND_MODEL" || match === "TITLE_VARIANT";
}

function quoteFor(product: SkuMarketProduct, quotes: readonly SkuSupplierQuote[], asOf: string): SkuSupplierQuote | null {
  const now = Date.parse(asOf);
  return [...quotes].filter((quote) => {
    if (!new Set(["received", "selected"]).has(quote.status)) return false;
    const fresh = quote.validUntil ? Date.parse(`${quote.validUntil}T23:59:59.999Z`) >= now : now - Date.parse(quote.updatedAt) <= 7 * 86_400_000;
    if (!fresh) return false;
    if (quote.supplierSku && [product.externalProductId, product.vendorItemId].some((id) => normalize(id) === normalize(quote.supplierSku))) return true;
    return sharedTokenRatio(product.title, quote.productName) >= .72 && variantsCompatible(product.title, quote.productName);
  }).sort((a, b) => (b.status === "selected" ? 1 : 0) - (a.status === "selected" ? 1 : 0) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || a.id - b.id)[0] ?? null;
}

function logisticsCost(quote: SkuSupplierQuote | null): number | null {
  if (!quote) return null;
  const perUnit = quote.threePlStoragePerUnit + quote.threePlOutboundPerUnit
    + (quote.threePlInboundTotal + quote.inspectionTotal + quote.packagingTotal + quote.labelingTotal + quote.domesticShippingTotal) / Math.max(1, quote.moq);
  return perUnit > 0 ? Math.round(perUnit * 100) / 100 : null;
}

export function buildSkuMarketRankings(input: Readonly<{
  opportunities: readonly MarketOpportunity[];
  products: readonly SkuMarketProduct[];
  packets: readonly ExternalMarketSignalPacket[];
  quotes: readonly SkuSupplierQuote[];
  now?: Date;
  limit?: number;
}>): SkuRankingPacket {
  const asOf = (input.now ?? new Date()).toISOString();
  const actualProducts = input.products.filter((product, index, all) => product.externalProductId && product.title && (product.url || product.source)
    && all.findIndex((candidate) => `${candidate.source}:${candidate.externalProductId}` === `${product.source}:${product.externalProductId}`) === index);
  const evaluated = actualProducts.map((product) => {
    const opportunityMatch = matchOpportunity(product, input.opportunities);
    const opportunity = opportunityMatch?.opportunity ?? null;
    const marketMatchScore = opportunityMatch?.score ?? 0;
    const coupangExact = isCoupang(product.source) || isCoupang(product.url);
    const coupangPackets = input.packets.filter((packet) => packet.source === "COUPANG" || isCoupang(packet.upstreamSource));
    const bestCoupang = coupangExact ? "COUPANG_EXACT" as const : coupangPackets.map((packet) => matchPacket(product, packet))
      .sort((a, b) => ["EXACT_ID", "BRAND_MODEL", "TITLE_VARIANT", "POSSIBLE_MATCH", "NO_MATCH"].indexOf(a) - ["EXACT_ID", "BRAND_MODEL", "TITLE_VARIANT", "POSSIBLE_MATCH", "NO_MATCH"].indexOf(b))[0] ?? "NO_MATCH";
    const relevant = input.packets.filter((packet) => relevantTikTok(product, packet, asOf));
    const allTikTok = input.packets.filter((packet) => packet.source === "TIKTOK");
    const tiktokScore = relevant.length ? clamp(relevant.reduce((sum, packet) => sum + finite(packet.socialMomentum.score), 0) / relevant.length) : 0;
    const quote = quoteFor(product, input.quotes, asOf);
    const skuLogistics = logisticsCost(quote);
    const price = finite(product.price, 0);
    const landed = quote ? quote.unitCost + (skuLogistics ?? 0) : 0;
    const marketplaceFee = quote && price > 0 ? price * quote.coupangFeeRate / 100 : 0;
    const returnAllowance = quote && price > 0 ? (landed + (skuLogistics ?? 0) * .5) * quote.expectedReturnRate / 100 : 0;
    const estimatedProfit = quote && price > 0 ? Math.round((price - landed - marketplaceFee - returnAllowance) * 100) / 100 : null;
    const economicsScore = estimatedProfit !== null && price > 0 ? clamp(estimatedProfit / price * 100) : 0;
    const productEvidenceScore = clamp((price > 0 ? 30 : 0) + (finite(product.reviewCount) > 0 ? 25 : 0) + (finite(product.rank) > 0 ? 15 : 0) + (coupangExact ? 30 : bestCoupang === "EXACT_ID" ? 25 : bestCoupang === "BRAND_MODEL" ? 18 : bestCoupang === "TITLE_VARIANT" ? 12 : 0));
    const identityProviders = [...new Set(actualProducts.filter((candidate) => sameIdentity(product, candidate)).map((candidate) => candidate.source))].sort();
    const packetIdentityProviders = input.packets.filter((packet) => new Set<SkuMatchStatus>(["EXACT_ID", "BRAND_MODEL", "TITLE_VARIANT"]).has(matchPacket(product, packet)))
      .flatMap((packet) => [packet.upstreamSource, packet.observedVia]).filter(Boolean);
    const corroboratingProviders = [...new Set([...identityProviders, ...packetIdentityProviders])].sort();
    const marketProviders = opportunity?.providers ?? [];
    const fresh = isFresh(product, asOf);
    const identityScore = coupangExact || bestCoupang === "EXACT_ID" ? 100
      : bestCoupang === "BRAND_MODEL" ? 85 : bestCoupang === "TITLE_VARIANT" ? 72
        : corroboratingProviders.length >= 2 ? 68 : bestCoupang === "POSSIBLE_MATCH" ? 45 : 30;
    const missing = [
      ...(marketMatchScore < 45 ? ["MARKET_OPPORTUNITY_MATCH"] : []),
      ...(marketProviders.length < 2 ? ["INDEPENDENT_MARKET_SOURCES"] : []),
      ...(identityScore < 60 ? ["PRODUCT_IDENTITY_CORROBORATION"] : []),
      ...(!fresh ? ["FRESH_PRODUCT_OBSERVATION"] : []),
      ...(!coupangExact && !new Set<SkuMatchStatus>(["EXACT_ID", "BRAND_MODEL", "TITLE_VARIANT"]).has(bestCoupang) ? ["COUPANG_IDENTICAL_PRODUCT_MATCH"] : []),
      ...(!quote ? ["FRESH_SUPPLIER_QUOTE"] : []), ...(!skuLogistics ? ["SKU_LOGISTICS_COST"] : []),
      ...(price <= 0 ? ["CURRENT_MARKET_PRICE"] : []), ...(relevant.length === 0 ? ["PRODUCT_RELEVANT_TIKTOK_SIGNAL"] : []),
    ];
    const marketScore = opportunity?.score ?? finite(product.opportunityScore);
    const base = marketScore * .42 + productEvidenceScore * .25 + tiktokScore * .10 + economicsScore * .18 + identityScore * .05;
    const freshnessScore = fresh ? 100 : 0;
    const confidence = clamp((opportunity?.confidence ?? 0) * .45 + productEvidenceScore * .25 + identityScore * .20 + freshnessScore * .10);
    const score = clamp(base * (0.72 + confidence / 100 * .28));
    const marketQualified = marketMatchScore >= 45 && marketProviders.length >= 2 && identityScore >= 60 && fresh && price > 0 && confidence >= 65;
    const qualification = marketQualified && quote && skuLogistics !== null ? "SELL_READY" : marketQualified ? "HIGH_CONFIDENCE" : "VERIFY_NEXT";
    const queries = searchQueries(product);
    return {
      rank: 0, skuKey: `${product.source}:${product.externalProductId}`, marketProductId: product.id, title: product.title,
      source: product.source, sourceUrl: product.url, coupangMatch: bestCoupang,
      coupangProductId: coupangExact ? product.externalProductId : null, score, confidence, concept: opportunity?.concept ?? "자동 교차검증 중",
      marketScore, productEvidenceScore, tiktokScore, economicsScore, priceKrw: product.price,
      reviewCount: product.reviewCount, supplierQuoteId: quote?.id ?? null, supplierQuoteFresh: Boolean(quote),
      skuLogisticsCostKrw: skuLogistics, estimatedProfitKrw: estimatedProfit, relevantTikTokSignals: relevant.length,
      ignoredTikTokSignals: Math.max(0, allTikTok.length - relevant.length), missingEvidence: Object.freeze(missing),
      reasons: Object.freeze([opportunity ? `${opportunity.concept} 교차매칭 ${Math.round(marketMatchScore)}` : "시장 상품군 자동 재탐색 필요", `${marketProviders.length}개 독립 시장출처 · 실상품 근거 ${Math.round(productEvidenceScore)}`, relevant.length ? `상품 관련 TikTok ${relevant.length}건` : "비상품 TikTok 신호 제외", quote ? `최신 견적 #${quote.id} 결합` : "최신 SKU 견적 미확보"]),
      qualification, marketMatchScore, marketProviders: Object.freeze([...marketProviders]), identityProviders: Object.freeze(corroboratingProviders), searchQueries: queries,
    } satisfies SkuMarketRanking;
  }).sort((a, b) => b.score - a.score || b.confidence - a.confidence || a.skuKey.localeCompare(b.skuKey));
  const limit = Math.max(1, Math.min(10, input.limit ?? 10));
  const rankings = evaluated.filter((item) => item.qualification !== "VERIFY_NEXT").slice(0, limit)
    .map((item, index) => Object.freeze({ ...item, rank: index + 1 }));
  const verificationQueue = evaluated.filter((item) => item.qualification === "VERIFY_NEXT").slice(0, 10)
    .map((item, index) => Object.freeze({ ...item, rank: index + 1 }));
  const discoveryQueries = Object.freeze([...new Set(verificationQueue.flatMap((item) => item.searchQueries))].slice(0, 12));
  const audit = Object.freeze({
    actualSkuProducts: actualProducts.length,
    highConfidenceProducts: rankings.length,
    sellReadyProducts: rankings.filter((item) => item.qualification === "SELL_READY").length,
    verificationQueueProducts: verificationQueue.length,
    scheduledSearchQueries: discoveryQueries.length,
    exactCoupangMatches: evaluated.filter((item) => item.coupangMatch === "COUPANG_EXACT" || item.coupangMatch === "EXACT_ID").length,
    relevantTikTokSignals: evaluated.reduce((sum, item) => sum + item.relevantTikTokSignals, 0),
    ignoredTikTokSignals: evaluated.reduce((sum, item) => sum + item.ignoredTikTokSignals, 0),
    freshSupplierQuotes: evaluated.filter((item) => item.supplierQuoteFresh).length,
    skuLogisticsBindings: evaluated.filter((item) => item.skuLogisticsCostKrw !== null).length,
  });
  const payload = { version: SKU_MARKET_RANKING_VERSION, asOf, rankings, verificationQueue, discoveryQueries, audit } as const;
  return Object.freeze({ ...payload, digest: digest(payload) });
}
