import { collectNaverShopping } from "../lib/market/external-provider-adapters";
import {
  COUPANG_MARKET_PRICE_ESTIMATE_VERSION,
  type CoupangMarketPriceEstimate,
} from "../shared/domain/coupang-market-price";
import type { SupplierCatalogItem } from "../shared/domain/supplier-catalog";
import type { MarketObservationInput } from "../types/market";

type NaverCollector = typeof collectNaverShopping;

const CONCURRENCY = 5;
const MAX_CANDIDATES = 30;
const TIMEOUT_MS = 4_000;

function normalizedQuery(name: string): string {
  return name
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[^0-9A-Za-z가-힣\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

function tokens(value: string): ReadonlySet<string> {
  return new Set(value
    .toLocaleLowerCase("ko-KR")
    .replace(/[^0-9a-z가-힣\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2));
}

function similarity(left: string, right: string): number {
  const a = tokens(left);
  const b = tokens(right);
  if (a.size === 0 || b.size === 0) return characterSimilarity(left, right);
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return Math.max(
    Math.round((shared / Math.sqrt(a.size * b.size)) * 1_000) / 1_000,
    characterSimilarity(left, right),
  );
}

function characterSimilarity(left: string, right: string): number {
  const normalize = (value: string) => value.toLocaleLowerCase("ko-KR").replace(/[^0-9a-z가-힣]/g, "");
  const bigrams = (value: string) => {
    const result = new Set<string>();
    for (let index = 0; index < value.length - 1; index += 1) result.add(value.slice(index, index + 2));
    return result;
  };
  const a = bigrams(normalize(left));
  const b = bigrams(normalize(right));
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const pair of a) if (b.has(pair)) shared += 1;
  return Math.round(((2 * shared) / (a.size + b.size)) * 1_000) / 1_000;
}

function percentile(sorted: readonly number[], ratio: number): number {
  if (sorted.length === 0) return 0;
  const position = (sorted.length - 1) * ratio;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const interpolated = (sorted[lower] ?? 0) +
    ((sorted[upper] ?? sorted[lower] ?? 0) - (sorted[lower] ?? 0)) * (position - lower);
  return Math.round(interpolated / 100) * 100;
}

function unavailable(query: string): CoupangMarketPriceEstimate {
  return Object.freeze({
    version: COUPANG_MARKET_PRICE_ESTIMATE_VERSION,
    status: "UNAVAILABLE",
    matchType: "UNAVAILABLE",
    query,
    observedAt: null,
    predictedSellingPriceKrw: null,
    lowSellingPriceKrw: null,
    highSellingPriceKrw: null,
    observationCount: 0,
    sourceReference: null,
    sampleOffers: Object.freeze([]),
  });
}

async function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("COUPANG_MARKET_PRICE_TIMEOUT")), TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function estimateOne(
  item: SupplierCatalogItem,
  collect: NaverCollector,
  broadObservations: readonly MarketObservationInput[],
): Promise<CoupangMarketPriceEstimate> {
  const query = normalizedQuery(item.name ?? "");
  if (query.length < 2) return unavailable(query);
  try {
    const result = await withTimeout(collect(query, { display: 30 }));
    const coupangOffers = [...result.observations, ...broadObservations]
      .filter((observation) =>
        /(쿠팡|coupang)/i.test(observation.product.sellerName?.trim() ?? "") &&
        typeof observation.snapshot.price === "number" &&
        observation.snapshot.price > 0)
      .map((observation) => ({
        observation,
        similarity: similarity(item.name ?? "", observation.product.title),
      }))
      .sort((left, right) => right.similarity - left.similarity ||
        (left.observation.snapshot.rank ?? Number.MAX_SAFE_INTEGER) -
          (right.observation.snapshot.rank ?? Number.MAX_SAFE_INTEGER));
    const deduplicated = [...new Map(coupangOffers.map((offer) => [
      `${offer.observation.product.externalProductId}:${offer.observation.snapshot.price}`,
      offer,
    ])).values()];
    const titleMatched = deduplicated.filter(({ similarity: score }) => score >= 0.16).slice(0, 10);
    const matched = titleMatched.length > 0
      ? titleMatched
      : deduplicated.filter(({ observation }) => broadObservations.includes(observation)).slice(0, 10);
    if (matched.length === 0) return unavailable(query);
    const matchType = titleMatched.length > 0 ? "TITLE_MATCHED" as const : "KEYWORD_COMPARABLE" as const;
    const prices = matched
      .map(({ observation }) => observation.snapshot.price as number)
      .sort((left, right) => left - right);
    const observedAt = matched
      .map(({ observation }) => observation.observedAt)
      .filter((value): value is string => typeof value === "string")
      .sort()
      .at(-1) ?? null;
    return Object.freeze({
      version: COUPANG_MARKET_PRICE_ESTIMATE_VERSION,
      status: "AVAILABLE",
      matchType,
      query,
      observedAt,
      predictedSellingPriceKrw: percentile(prices, 0.5),
      lowSellingPriceKrw: percentile(prices, 0.25),
      highSellingPriceKrw: percentile(prices, 0.75),
      observationCount: prices.length,
      sourceReference: "naver-shopping-official:coupang-public-offers",
      sampleOffers: Object.freeze(matched.slice(0, 3).map(({ observation, similarity: score }) => Object.freeze({
        title: observation.product.title,
        priceKrw: observation.snapshot.price as number,
        url: observation.product.url ?? null,
        similarity: score,
      }))),
    });
  } catch {
    return unavailable(query);
  }
}

/**
 * Reads current public shopping-search observations and keeps only offers whose
 * disclosed mall is Coupang. It never calls WING or performs a commerce write.
 */
export async function loadCoupangMarketPriceEstimates(
  items: readonly SupplierCatalogItem[],
  keyword = "",
  collect: NaverCollector = collectNaverShopping,
): Promise<ReadonlyMap<string, CoupangMarketPriceEstimate>> {
  const result = new Map<string, CoupangMarketPriceEstimate>();
  const bounded = items.slice(0, MAX_CANDIDATES);
  let broadObservations: readonly MarketObservationInput[] = [];
  const broadQuery = normalizedQuery(keyword);
  if (broadQuery.length >= 2) {
    try {
      const broadResults = await Promise.allSettled([
        withTimeout(collect(broadQuery, { display: 100 })),
        withTimeout(collect(`${broadQuery} 쿠팡`, { display: 100 })),
      ]);
      broadObservations = broadResults.flatMap((entry) =>
        entry.status === "fulfilled" ? entry.value.observations : []
      );
    } catch {
      broadObservations = [];
    }
  }
  for (let offset = 0; offset < bounded.length; offset += CONCURRENCY) {
    const batch = bounded.slice(offset, offset + CONCURRENCY);
    const estimates = await Promise.all(batch.map((item) => estimateOne(item, collect, broadObservations)));
    batch.forEach((item, index) => result.set(item.providerItemId, estimates[index] ?? unavailable(normalizedQuery(item.name ?? ""))));
  }
  return result;
}
