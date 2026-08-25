import type { MarketDiscoverySignal } from "../../shared/domain/market-discovery-evidence";
import type { MarketObservationInput } from "../../types/market";

export type ExternalMarketProvider = "naver_shopping" | "youtube_data" | "dataforseo_naver";

export type ExternalProviderCredentials = Readonly<{
  naverClientId?: string;
  naverClientSecret?: string;
  youtubeApiKey?: string;
  dataForSeoLogin?: string;
  dataForSeoPassword?: string;
  dataForSeoMaxCostUsd?: number;
}>;

export type ExternalProviderResult = Readonly<{
  provider: ExternalMarketProvider;
  observations: readonly MarketObservationInput[];
  discoverySignals: readonly MarketDiscoverySignal[];
  requestCount: number;
  quotaUnits: number;
  estimatedCostUsd: number;
}>;

export type CoupangPublicPriceSearchResult = Readonly<{
  observations: readonly MarketObservationInput[];
  requestCount: number;
  estimatedCostUsd: number;
}>;

type Requester = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function credentialsFromEnvironment(): ExternalProviderCredentials {
  return {
    naverClientId: process.env.NAVER_CLIENT_ID,
    naverClientSecret: process.env.NAVER_CLIENT_SECRET,
    youtubeApiKey: process.env.YOUTUBE_DATA_API_KEY,
    dataForSeoLogin: process.env.DATAFORSEO_LOGIN,
    dataForSeoPassword: process.env.DATAFORSEO_PASSWORD,
    dataForSeoMaxCostUsd: process.env.DATAFORSEO_MAX_COST_USD_PER_REQUEST ? Number(process.env.DATAFORSEO_MAX_COST_USD_PER_REQUEST) : undefined,
  };
}

function required(value: string | undefined, code: string): string {
  if (!value?.trim()) throw new Error(code);
  return value.trim();
}

function boundedKeyword(keyword: string): string {
  const normalized = keyword.trim().replace(/\s+/g, " ");
  if (normalized.length < 2 || normalized.length > 100) throw new Error("MARKET_KEYWORD_INVALID");
  return normalized;
}

function text(value: unknown, max = 500): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

function number(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(/,/g, "")) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function observedAt(): string {
  return new Date().toISOString();
}

function discoverySignal(input: Readonly<{
  sourceId: string;
  sourceKind: "official_api" | "paid_api" | "short_video_public";
  query: string;
  externalProductId: string;
  title: string;
  sourceUrl: string | null;
  observedAt: string;
  rank: number | null;
  popularityScore: number | null;
  contentVelocity: number | null;
}>): MarketDiscoverySignal {
  return {
    sourceId: input.sourceId,
    sourceKind: input.sourceKind,
    query: input.query,
    externalProductId: input.externalProductId,
    title: input.title,
    category: null,
    sourceUrl: input.sourceUrl,
    observedAt: input.observedAt,
    rank: input.rank,
    price: null,
    reviewCount: null,
    popularityScore: input.popularityScore,
    engagementRate: null,
    contentVelocity: input.contentVelocity,
    assetRights: "UNKNOWN",
  };
}

async function jsonResponse(response: Response, code: string): Promise<unknown> {
  if (response.status === 403) throw new Error(`${code}_FORBIDDEN`);
  if (response.status === 429) throw new Error(`${code}_RATE_LIMITED`);
  if (!response.ok) throw new Error(`${code}_HTTP_${response.status}`);
  try {
    return await response.json();
  } catch {
    throw new Error(`${code}_INVALID_JSON`);
  }
}

export async function collectNaverShopping(
  keyword: string,
  options: Readonly<{ credentials?: ExternalProviderCredentials; request?: Requester; display?: number }> = {},
): Promise<ExternalProviderResult> {
  const query = boundedKeyword(keyword);
  const credentials = options.credentials ?? credentialsFromEnvironment();
  const clientId = required(credentials.naverClientId, "NAVER_CREDENTIALS_MISSING");
  const clientSecret = required(credentials.naverClientSecret, "NAVER_CREDENTIALS_MISSING");
  const display = Math.min(100, Math.max(1, options.display ?? 30));
  const url = new URL("https://openapi.naver.com/v1/search/shop.json");
  url.searchParams.set("query", query);
  url.searchParams.set("display", String(display));
  url.searchParams.set("start", "1");
  url.searchParams.set("sort", "sim");
  const response = await (options.request ?? fetch)(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
    cache: "no-store",
  });
  const body = await jsonResponse(response, "NAVER_SHOPPING");
  if (typeof body !== "object" || body === null || !Array.isArray((body as { items?: unknown }).items)) {
    throw new Error("NAVER_SHOPPING_RESPONSE_INVALID");
  }
  const timestamp = observedAt();
  const observations = (body as { items: unknown[] }).items.slice(0, display).flatMap((item, index): MarketObservationInput[] => {
    if (typeof item !== "object" || item === null) return [];
    const record = item as Record<string, unknown>;
    const externalProductId = text(record.productId, 200);
    const title = text(record.title);
    if (!externalProductId || !title) return [];
    return [{
      source: "naver_official",
      keyword: query,
      observedAt: timestamp,
      product: {
        externalProductId,
        vendorItemId: null,
        url: text(record.link, 2_000),
        title,
        brand: text(record.brand),
        sellerName: text(record.mallName),
        category: null,
        thumbnailUrl: text(record.image, 2_000),
      },
      snapshot: {
        rank: index + 1,
        isAd: null,
        price: number(record.lprice),
        listPrice: number(record.hprice),
        rating: null,
        reviewCount: null,
        rocketType: null,
        isSoldOut: null,
        deliveryDays: null,
        optionCount: null,
      },
    }];
  });
  return Object.freeze({ provider: "naver_shopping", observations: Object.freeze(observations), discoverySignals: Object.freeze([]), requestCount: 1, quotaUnits: 1, estimatedCostUsd: 0 });
}

function nestedSerpItems(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): Record<string, unknown>[] => {
    if (typeof entry !== "object" || entry === null) return [];
    const record = entry as Record<string, unknown>;
    return [record, ...nestedSerpItems(record.items)];
  });
}

function krwPriceFromText(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const wonSuffix = value.match(/(?:₩|KRW\s*)?([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,9})\s*원/i);
  const wonPrefix = value.match(/₩\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,9})/i);
  const raw = wonSuffix?.[1] ?? wonPrefix?.[1];
  if (!raw) return null;
  const parsed = Number(raw.replaceAll(",", ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Reads current public Coupang price snippets exposed by Google through the
 * approved bounded DataForSEO Live SERP API. This is a search observation,
 * not a Coupang seller API call and never performs a marketplace write.
 */
export async function collectDataForSeoCoupangPrices(
  keyword: string,
  options: Readonly<{ credentials?: ExternalProviderCredentials; request?: Requester }> = {},
): Promise<CoupangPublicPriceSearchResult> {
  const query = boundedKeyword(keyword);
  const credentials = options.credentials ?? credentialsFromEnvironment();
  const login = required(credentials.dataForSeoLogin, "DATAFORSEO_CREDENTIALS_MISSING");
  const password = required(credentials.dataForSeoPassword, "DATAFORSEO_CREDENTIALS_MISSING");
  const maxCostUsd = credentials.dataForSeoMaxCostUsd;
  if (maxCostUsd === undefined || !Number.isFinite(maxCostUsd) || maxCostUsd <= 0) {
    throw new Error("DATAFORSEO_COST_CEILING_MISSING");
  }
  const basic = Buffer.from(`${login}:${password}`, "utf8").toString("base64");
  const response = await (options.request ?? fetch)("https://api.dataforseo.com/v3/serp/google/organic/live/advanced", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Basic ${basic}` },
    body: JSON.stringify([{
      keyword: `${query} 쿠팡`,
      location_name: "South Korea",
      language_code: "ko",
      device: "desktop",
      depth: 10,
    }]),
    cache: "no-store",
  });
  const body = await jsonResponse(response, "DATAFORSEO_GOOGLE_COUPANG");
  const task = typeof body === "object" && body !== null && Array.isArray((body as { tasks?: unknown }).tasks)
    ? (body as { tasks: unknown[] }).tasks[0]
    : null;
  const taskCost = typeof task === "object" && task !== null ? number((task as Record<string, unknown>).cost) ?? 0 : 0;
  if (taskCost > maxCostUsd) throw new Error("DATAFORSEO_COST_CEILING_EXCEEDED");
  const result = typeof task === "object" && task !== null && Array.isArray((task as { result?: unknown }).result)
    ? (task as { result: unknown[] }).result[0]
    : null;
  const topLevelItems = typeof result === "object" && result !== null ? (result as Record<string, unknown>).items : [];
  const timestamp = observedAt();
  const observations = nestedSerpItems(topLevelItems).flatMap((record, index): MarketObservationInput[] => {
    const title = text(record.title);
    const url = text(record.url, 2_000);
    const domain = text(record.domain, 300);
    const source = text(record.source, 300);
    const sellerIdentity = `${domain ?? ""} ${url ?? ""} ${source ?? ""}`;
    const priceRecord = typeof record.price === "object" && record.price !== null
      ? record.price as Record<string, unknown>
      : null;
    const currentPrice = number(priceRecord?.current)
      ?? krwPriceFromText(priceRecord?.displayed_price)
      ?? krwPriceFromText(record.description)
      ?? krwPriceFromText(record.snippet);
    const currency = text(priceRecord?.currency, 20)?.toUpperCase();
    if (!title || currentPrice === null || currentPrice <= 0 || !/(^|\.)coupang\.com|쿠팡/i.test(sellerIdentity)) return [];
    if (currency && currency !== "KRW") return [];
    const externalProductId = text(record.product_id, 200) ?? text(record.data_docid, 200) ?? url ?? `coupang-serp-${index + 1}`;
    return [{
      source: "coupang_public",
      keyword: query,
      observedAt: timestamp,
      product: {
        externalProductId,
        vendorItemId: null,
        url,
        title,
        brand: null,
        sellerName: source ?? domain ?? "쿠팡",
        category: null,
        thumbnailUrl: null,
      },
      snapshot: {
        rank: number(record.rank_absolute) ?? number(record.rank_group) ?? index + 1,
        isAd: null,
        price: currentPrice,
        listPrice: number(priceRecord?.regular),
        rating: typeof record.rating === "object" && record.rating !== null ? number((record.rating as Record<string, unknown>).value) : null,
        reviewCount: typeof record.rating === "object" && record.rating !== null ? number((record.rating as Record<string, unknown>).votes_count) : null,
        rocketType: null,
        isSoldOut: null,
        deliveryDays: null,
        optionCount: null,
      },
    }];
  });
  const unique = [...new Map(observations.map((entry) => [
    `${entry.product.externalProductId}:${entry.snapshot.price}`,
    entry,
  ])).values()];
  return Object.freeze({ observations: Object.freeze(unique), requestCount: 1, estimatedCostUsd: taskCost });
}

export async function collectYouTubeVideoSignals(
  keyword: string,
  options: Readonly<{ credentials?: ExternalProviderCredentials; request?: Requester; maxResults?: number }> = {},
): Promise<ExternalProviderResult> {
  const query = boundedKeyword(keyword);
  const key = required((options.credentials ?? credentialsFromEnvironment()).youtubeApiKey, "YOUTUBE_CREDENTIALS_MISSING");
  const request = options.request ?? fetch;
  const maxResults = Math.min(10, Math.max(1, options.maxResults ?? 10));
  const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("maxResults", String(maxResults));
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("regionCode", "KR");
  searchUrl.searchParams.set("relevanceLanguage", "ko");
  searchUrl.searchParams.set("key", key);
  const searchBody = await jsonResponse(await request(searchUrl, { method: "GET", cache: "no-store" }), "YOUTUBE_SEARCH");
  const searchItems = typeof searchBody === "object" && searchBody !== null && Array.isArray((searchBody as { items?: unknown }).items)
    ? (searchBody as { items: unknown[] }).items
    : [];
  const timestamp = observedAt();
  const signals = searchItems.flatMap((item, index): MarketDiscoverySignal[] => {
    if (typeof item !== "object" || item === null) return [];
    const record = item as Record<string, unknown>;
    const id = record.id as Record<string, unknown> | undefined;
    const snippet = record.snippet as Record<string, unknown> | undefined;
    const videoId = text(id?.videoId, 200);
    const title = text(snippet?.title);
    if (!videoId || !title) return [];
    const publishedAt = typeof snippet?.publishedAt === "string" && Number.isFinite(Date.parse(snippet.publishedAt)) ? snippet.publishedAt : timestamp;
    return [discoverySignal({ sourceId: "youtube-data-api", sourceKind: "short_video_public", query, externalProductId: videoId, title, sourceUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`, observedAt: publishedAt, rank: index + 1, popularityScore: null, contentVelocity: null })];
  });
  return Object.freeze({ provider: "youtube_data", observations: Object.freeze([]), discoverySignals: Object.freeze(signals), requestCount: 1, quotaUnits: 100, estimatedCostUsd: 0 });
}

export async function collectDataForSeoNaverSignals(
  keyword: string,
  options: Readonly<{ credentials?: ExternalProviderCredentials; request?: Requester }> = {},
): Promise<ExternalProviderResult> {
  const query = boundedKeyword(keyword);
  const credentials = options.credentials ?? credentialsFromEnvironment();
  const login = required(credentials.dataForSeoLogin, "DATAFORSEO_CREDENTIALS_MISSING");
  const password = required(credentials.dataForSeoPassword, "DATAFORSEO_CREDENTIALS_MISSING");
  const maxCostUsd = credentials.dataForSeoMaxCostUsd;
  if (maxCostUsd === undefined || !Number.isFinite(maxCostUsd) || maxCostUsd <= 0) throw new Error("DATAFORSEO_COST_CEILING_MISSING");
  const basic = Buffer.from(`${login}:${password}`, "utf8").toString("base64");
  const response = await (options.request ?? fetch)("https://api.dataforseo.com/v3/serp/naver/organic/live/advanced", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Basic ${basic}` },
    body: JSON.stringify([{ keyword: query, device: "desktop", se_domain: "search.naver.com", depth: 15 }]),
    cache: "no-store",
  });
  const body = await jsonResponse(response, "DATAFORSEO_NAVER");
  const task = typeof body === "object" && body !== null && Array.isArray((body as { tasks?: unknown }).tasks)
    ? (body as { tasks: unknown[] }).tasks[0]
    : null;
  const taskCost = typeof task === "object" && task !== null && typeof (task as { cost?: unknown }).cost === "number" ? (task as { cost: number }).cost : 0;
  if (taskCost > maxCostUsd) throw new Error("DATAFORSEO_COST_CEILING_EXCEEDED");
  const result = typeof task === "object" && task !== null && Array.isArray((task as { result?: unknown }).result)
    ? (task as { result: unknown[] }).result[0]
    : null;
  const items = typeof result === "object" && result !== null && Array.isArray((result as { items?: unknown }).items)
    ? (result as { items: unknown[] }).items
    : [];
  const timestamp = observedAt();
  const signals = items.flatMap((item, index): MarketDiscoverySignal[] => {
    if (typeof item !== "object" || item === null) return [];
    const record = item as Record<string, unknown>;
    const title = text(record.title);
    const url = text(record.url, 2_000);
    const externalProductId = url ?? `naver-serp-${index + 1}`;
    if (!title) return [];
    return [discoverySignal({ sourceId: "dataforseo-naver-serp", sourceKind: "paid_api", query, externalProductId, title, sourceUrl: url, observedAt: timestamp, rank: number(record.rank_absolute) ?? index + 1, popularityScore: null, contentVelocity: null })];
  });
  const observations = signals.map((signal): MarketObservationInput => ({
    source: "dataforseo_naver",
    keyword: query,
    observedAt: signal.observedAt,
    product: {
      externalProductId: signal.externalProductId,
      vendorItemId: null,
      url: signal.sourceUrl,
      title: signal.title,
      brand: null,
      sellerName: null,
      category: null,
      thumbnailUrl: null,
    },
    snapshot: {
      rank: signal.rank,
      isAd: null,
      price: null,
      listPrice: null,
      rating: null,
      reviewCount: null,
      rocketType: null,
      isSoldOut: null,
      deliveryDays: null,
      optionCount: null,
    },
  }));
  return Object.freeze({ provider: "dataforseo_naver", observations: Object.freeze(observations), discoverySignals: Object.freeze(signals), requestCount: 1, quotaUnits: 0, estimatedCostUsd: taskCost });
}

export async function collectExternalMarketProvider(
  provider: ExternalMarketProvider,
  keyword: string,
  options: Readonly<{ credentials?: ExternalProviderCredentials; request?: Requester }> = {},
): Promise<ExternalProviderResult> {
  if (provider === "naver_shopping") return collectNaverShopping(keyword, options);
  if (provider === "youtube_data") return collectYouTubeVideoSignals(keyword, options);
  return collectDataForSeoNaverSignals(keyword, options);
}
