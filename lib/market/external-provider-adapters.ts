import type { MarketDiscoverySignal } from "../../shared/domain/market-discovery-evidence";
import type { MarketObservationInput } from "../../types/market";
import { resolveNaverShoppingCategory } from "./naver-shopping-category-policy";

export type ExternalMarketProvider = "naver_api_hub" | "naver_shopping" | "youtube_data" | "dataforseo_naver";

export type ExternalProviderCredentials = Readonly<{
  naverClientId?: string;
  naverClientSecret?: string;
  naverShoppingCategoryId?: string;
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
    naverClientId: process.env.NAVER_API_HUB_CLIENT_ID ?? process.env.NAVER_CLIENT_ID,
    naverClientSecret: process.env.NAVER_API_HUB_CLIENT_SECRET ?? process.env.NAVER_CLIENT_SECRET,
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

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function trendWindow(now: Date): Readonly<{ startDate: string; endDate: string }> {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 29);
  return { startDate: isoDate(start), endDate: isoDate(end) };
}

function discoverySignal(input: Readonly<{
  sourceId: string;
  sourceKind: "official_api" | "paid_api" | "short_video_public";
  query: string;
  externalProductId: string;
  title: string;
  category?: string | null;
  sourceUrl: string | null;
  observedAt: string;
  rank: number | null;
  popularityScore: number | null;
  contentVelocity: number | null;
  channelId?: string | null;
  channelTitle?: string | null;
  channelCountry?: string | null;
  description?: string | null;
  tags?: readonly string[] | null;
  thumbnailUrl?: string | null;
  viewCount?: number | null;
  likeCount?: number | null;
  commentCount?: number | null;
  subscriberCount?: number | null;
  durationSeconds?: number | null;
  isShort?: boolean | null;
}>): MarketDiscoverySignal {
  return {
    sourceId: input.sourceId,
    sourceKind: input.sourceKind,
    query: input.query,
    externalProductId: input.externalProductId,
    title: input.title,
    category: input.category ?? null,
    sourceUrl: input.sourceUrl,
    observedAt: input.observedAt,
    rank: input.rank,
    price: null,
    reviewCount: null,
    popularityScore: input.popularityScore,
    engagementRate: null,
    contentVelocity: input.contentVelocity,
    channelId: input.channelId ?? null,
    channelTitle: input.channelTitle ?? null,
    channelCountry: input.channelCountry ?? null,
    description: input.description ?? null,
    tags: input.tags ?? [],
    thumbnailUrl: input.thumbnailUrl ?? null,
    viewCount: input.viewCount ?? null,
    likeCount: input.likeCount ?? null,
    commentCount: input.commentCount ?? null,
    subscriberCount: input.subscriberCount ?? null,
    durationSeconds: input.durationSeconds ?? null,
    isShort: input.isShort ?? null,
    assetRights: "UNKNOWN",
  };
}

function isoDurationSeconds(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;
  return Number(match[1] ?? 0) * 3_600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}

async function jsonResponse(response: Response, code: string): Promise<unknown> {
  if (response.status === 401) throw new Error(`${code}_UNAUTHORIZED`);
  if (response.status === 403) throw new Error(`${code}_FORBIDDEN`);
  if (response.status === 429) throw new Error(`${code}_RATE_LIMITED`);
  if (!response.ok) throw new Error(`${code}_HTTP_${response.status}`);
  try {
    return await response.json();
  } catch {
    throw new Error(`${code}_INVALID_JSON`);
  }
}

type NaverTrendPoint = Readonly<{ period: string; ratio: number }>;

function naverTrendPoints(value: unknown): NaverTrendPoint[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): NaverTrendPoint[] => {
    if (typeof entry !== "object" || entry === null) return [];
    const record = entry as Record<string, unknown>;
    const ratio = number(record.ratio);
    if (typeof record.period !== "string" || ratio === null || ratio < 0 || ratio > 100) return [];
    return [{ period: record.period, ratio }];
  }).sort((left, right) => left.period.localeCompare(right.period));
}

function trendSignal(input: Readonly<{
  sourceId: string;
  query: string;
  title: string;
  category?: string | null;
  sourceUrl: string;
  timestamp: string;
  points: readonly NaverTrendPoint[];
}>): MarketDiscoverySignal | null {
  if (input.points.length === 0) return null;
  const first = input.points[0]?.ratio ?? 0;
  const latest = input.points.at(-1)?.ratio ?? 0;
  return discoverySignal({
    sourceId: input.sourceId,
    sourceKind: "official_api",
    query: input.query,
    externalProductId: `${input.sourceId}:${input.query}`,
    title: input.title,
    category: input.category,
    sourceUrl: input.sourceUrl,
    observedAt: input.timestamp,
    rank: null,
    popularityScore: latest,
    contentVelocity: Math.max(0, Math.round((latest - first) * 1_000) / 1_000),
  });
}

/**
 * Collects relative search/click trends from NAVER API HUB. The discontinued
 * Naver Developers Shopping Search endpoint returned product offers; API HUB
 * DataLab endpoints do not. Therefore this adapter deliberately returns
 * discovery signals only and never fabricates product, price, or seller rows.
 */
export async function collectNaverApiHubTrends(
  keyword: string,
  options: Readonly<{ credentials?: ExternalProviderCredentials; request?: Requester; now?: Date }> = {},
): Promise<ExternalProviderResult> {
  const query = boundedKeyword(keyword);
  const credentials = options.credentials ?? credentialsFromEnvironment();
  const clientId = required(credentials.naverClientId, "NAVER_CREDENTIALS_MISSING");
  const clientSecret = required(credentials.naverClientSecret, "NAVER_CREDENTIALS_MISSING");
  const verifiedCategory = resolveNaverShoppingCategory(query);
  const categoryId = credentials.naverShoppingCategoryId?.trim() ?? verifiedCategory?.categoryCode;
  if (categoryId && !/^\d{8,12}$/.test(categoryId)) throw new Error("NAVER_SHOPPING_CATEGORY_INVALID");
  const request = options.request ?? fetch;
  const now = options.now ?? new Date();
  const window = trendWindow(now);
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-NCP-APIGW-API-KEY-ID": clientId,
    "X-NCP-APIGW-API-KEY": clientSecret,
  };
  const searchUrl = "https://naverapihub.apigw.ntruss.com/search-trend/v1/search";
  const searchResponse = await request(searchUrl, {
    method: "POST",
    headers: {
      ...headers,
    },
    body: JSON.stringify({ ...window, timeUnit: "date", keywordGroups: [{ groupName: query, keywords: [query] }] }),
    cache: "no-store",
  });
  const searchBody = await jsonResponse(searchResponse, "NAVER_API_HUB_SEARCH_TREND");
  if (typeof searchBody !== "object" || searchBody === null || !Array.isArray((searchBody as { results?: unknown }).results)) {
    throw new Error("NAVER_API_HUB_SEARCH_TREND_RESPONSE_INVALID");
  }
  const timestamp = now.toISOString();
  const searchResult = (searchBody as { results: unknown[] }).results[0];
  const searchRecord = typeof searchResult === "object" && searchResult !== null ? searchResult as Record<string, unknown> : {};
  const signals: MarketDiscoverySignal[] = [];
  const searchSignal = trendSignal({
    sourceId: "naver-api-hub-search-trend",
    query,
    title: `${query} 통합검색 추이`,
    sourceUrl: "https://api.ncloud-docs.com/docs/naver-api-hub-search-trend",
    timestamp,
    points: naverTrendPoints(searchRecord.data),
  });
  if (searchSignal) signals.push(searchSignal);

  let requestCount = 1;
  if (categoryId) {
    requestCount += 1;
    const shoppingUrl = "https://naverapihub.apigw.ntruss.com/shopping/v1/category/keywords";
    const shoppingResponse = await request(shoppingUrl, {
      method: "POST",
      headers: { ...headers },
      body: JSON.stringify({ ...window, timeUnit: "date", category: categoryId, keyword: [{ name: query, param: [query] }] }),
      cache: "no-store",
    });
    const shoppingBody = await jsonResponse(shoppingResponse, "NAVER_API_HUB_SHOPPING_INSIGHT");
    if (typeof shoppingBody !== "object" || shoppingBody === null || !Array.isArray((shoppingBody as { results?: unknown }).results)) {
      throw new Error("NAVER_API_HUB_SHOPPING_INSIGHT_RESPONSE_INVALID");
    }
    const shoppingResult = (shoppingBody as { results: unknown[] }).results[0];
    const shoppingRecord = typeof shoppingResult === "object" && shoppingResult !== null ? shoppingResult as Record<string, unknown> : {};
    const shoppingSignal = trendSignal({
      sourceId: "naver-api-hub-shopping-insight",
      query,
      title: `${query} 쇼핑 클릭 추이`,
      category: categoryId,
      sourceUrl: "https://api.ncloud-docs.com/docs/naver-api-hub-shopping-insight-keywords",
      timestamp,
      points: naverTrendPoints(shoppingRecord.data),
    });
    if (shoppingSignal) signals.push(shoppingSignal);
  }
  return Object.freeze({
    provider: "naver_api_hub",
    observations: Object.freeze([]),
    discoverySignals: Object.freeze(signals),
    requestCount,
    quotaUnits: requestCount,
    estimatedCostUsd: 0,
  });
}

/** @deprecated Compatibility alias for existing jobs created as naver-shopping-api. */
export async function collectNaverShopping(
  keyword: string,
  options: Readonly<{ credentials?: ExternalProviderCredentials; request?: Requester; display?: number; now?: Date }> = {},
): Promise<ExternalProviderResult> {
  return collectNaverApiHubTrends(keyword, options);
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

function explicitSoldOutState(record: Record<string, unknown>, priceRecord: Record<string, unknown> | null): boolean | null {
  const explicit = [record.is_sold_out, record.sold_out, record.in_stock, record.available];
  if (explicit[0] === true || explicit[1] === true || explicit[2] === false || explicit[3] === false) return true;
  if (explicit[0] === false || explicit[1] === false || explicit[2] === true || explicit[3] === true) return false;
  const searchable = [record.availability, record.stock_status, record.description, record.snippet, priceRecord?.status]
    .filter((value): value is string => typeof value === "string").join(" ").normalize("NFC").toLocaleLowerCase("ko-KR");
  if (/(?:품절|일시품절|재고\s*없음|판매\s*중지|sold\s*out|out\s*of\s*stock|unavailable)/iu.test(searchable)) return true;
  if (/(?:재고\s*있음|구매\s*가능|판매\s*중|배송\s*가능|in\s*stock|available)/iu.test(searchable)) return false;
  return null;
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
        isSoldOut: explicitSoldOutState(record, priceRecord),
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
  const videoIds = searchItems.flatMap((item): string[] => {
    if (typeof item !== "object" || item === null) return [];
    const id = (item as Record<string, unknown>).id;
    if (typeof id !== "object" || id === null) return [];
    const videoId = text((id as Record<string, unknown>).videoId, 200);
    return videoId ? [videoId] : [];
  });
  const videoById = new Map<string, Record<string, unknown>>();
  if (videoIds.length) {
    const videoUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    videoUrl.searchParams.set("part", "snippet,statistics,contentDetails");
    videoUrl.searchParams.set("id", videoIds.join(","));
    videoUrl.searchParams.set("key", key);
    const videoBody = await jsonResponse(await request(videoUrl, { method: "GET", cache: "no-store" }), "YOUTUBE_VIDEOS");
    const videoItems = typeof videoBody === "object" && videoBody !== null && Array.isArray((videoBody as { items?: unknown }).items)
      ? (videoBody as { items: unknown[] }).items : [];
    for (const item of videoItems) {
      if (typeof item !== "object" || item === null) continue;
      const record = item as Record<string, unknown>;
      const videoId = text(record.id, 200);
      if (videoId) videoById.set(videoId, record);
    }
  }
  const channelIds = [...new Set(searchItems.flatMap((item): string[] => {
    if (typeof item !== "object" || item === null) return [];
    const snippet = (item as Record<string, unknown>).snippet;
    if (typeof snippet !== "object" || snippet === null) return [];
    const channelId = text((snippet as Record<string, unknown>).channelId, 200);
    return channelId ? [channelId] : [];
  }))];
  const subscribersByChannel = new Map<string, number>();
  const countryByChannel = new Map<string, string>();
  if (channelIds.length) {
    const channelUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
    channelUrl.searchParams.set("part", "snippet,statistics");
    channelUrl.searchParams.set("id", channelIds.join(","));
    channelUrl.searchParams.set("key", key);
    const channelBody = await jsonResponse(await request(channelUrl, { method: "GET", cache: "no-store" }), "YOUTUBE_CHANNELS");
    const channelItems = typeof channelBody === "object" && channelBody !== null && Array.isArray((channelBody as { items?: unknown }).items)
      ? (channelBody as { items: unknown[] }).items : [];
    for (const item of channelItems) {
      if (typeof item !== "object" || item === null) continue;
      const record = item as Record<string, unknown>;
      const channelId = text(record.id, 200);
      const statistics = typeof record.statistics === "object" && record.statistics !== null ? record.statistics as Record<string, unknown> : {};
      const subscriberCount = number(statistics.subscriberCount);
      if (channelId && subscriberCount !== null) subscribersByChannel.set(channelId, subscriberCount);
      const channelSnippet = typeof record.snippet === "object" && record.snippet !== null ? record.snippet as Record<string, unknown> : {};
      const country = text(channelSnippet.country, 10);
      if (channelId && country) countryByChannel.set(channelId, country.toUpperCase());
    }
  }
  const signals = searchItems.flatMap((item, index): MarketDiscoverySignal[] => {
    if (typeof item !== "object" || item === null) return [];
    const record = item as Record<string, unknown>;
    const id = record.id as Record<string, unknown> | undefined;
    const snippet = record.snippet as Record<string, unknown> | undefined;
    const videoId = text(id?.videoId, 200);
    const title = text(snippet?.title);
    if (!videoId || !title) return [];
    const publishedAt = typeof snippet?.publishedAt === "string" && Number.isFinite(Date.parse(snippet.publishedAt)) ? snippet.publishedAt : timestamp;
    const videoDetails = videoById.get(videoId) ?? {};
    const statistics = typeof videoDetails.statistics === "object" && videoDetails.statistics !== null
      ? videoDetails.statistics as Record<string, unknown> : {};
    const views = number(statistics?.viewCount);
    const likes = number(statistics?.likeCount);
    const comments = number(statistics?.commentCount);
    const videoRecord = searchItems[index] && typeof searchItems[index] === "object" ? searchItems[index] as Record<string, unknown> : {};
    const detailsSnippet = typeof videoDetails.snippet === "object" && videoDetails.snippet !== null ? videoDetails.snippet as Record<string, unknown> : {};
    const searchSnippet = typeof videoRecord.snippet === "object" && videoRecord.snippet !== null ? videoRecord.snippet as Record<string, unknown> : {};
    const channelId = text(detailsSnippet.channelId, 200) ?? text(searchSnippet.channelId, 200);
    const channelTitle = text(detailsSnippet.channelTitle, 300) ?? text(searchSnippet.channelTitle, 300);
    const description = text(detailsSnippet.description, 2_000) ?? text(searchSnippet.description, 2_000);
    const tags = Array.isArray(detailsSnippet.tags) ? detailsSnippet.tags.flatMap((value): string[] => {
      const tag = text(value, 100);
      return tag ? [tag] : [];
    }).slice(0, 30) : [];
    const contentDetails = typeof videoDetails.contentDetails === "object" && videoDetails.contentDetails !== null ? videoDetails.contentDetails as Record<string, unknown> : {};
    const durationSeconds = isoDurationSeconds(contentDetails.duration);
    const thumbnails = typeof searchSnippet.thumbnails === "object" && searchSnippet.thumbnails !== null ? searchSnippet.thumbnails as Record<string, unknown> : {};
    const mediumThumbnail = typeof thumbnails.medium === "object" && thumbnails.medium !== null ? thumbnails.medium as Record<string, unknown> : {};
    const thumbnailUrl = text(mediumThumbnail.url, 2_000);
    const ageDays = Math.max(1, (Date.parse(timestamp) - Date.parse(publishedAt)) / 86_400_000);
    const popularityScore = views === null ? null : Math.min(100, Math.round(Math.log10(Math.max(1, views)) / 7 * 10_000) / 100);
    const contentVelocity = views === null ? null : Math.min(100, Math.round(Math.log10(Math.max(1, views / ageDays)) / 5 * 10_000) / 100);
    return [discoverySignal({
      sourceId: "youtube-data-api", sourceKind: "short_video_public", query, externalProductId: videoId, title,
      sourceUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`, observedAt: publishedAt,
      rank: index + 1, popularityScore, contentVelocity, channelId, channelTitle, thumbnailUrl,
      viewCount: views, likeCount: likes, commentCount: comments,
      subscriberCount: channelId ? subscribersByChannel.get(channelId) ?? null : null,
      channelCountry: channelId ? countryByChannel.get(channelId) ?? null : null,
      description, tags,
      durationSeconds, isShort: durationSeconds === null ? null : durationSeconds <= 180,
    })];
  });
  const requestCount = 1 + (videoIds.length ? 1 : 0) + (channelIds.length ? 1 : 0);
  return Object.freeze({ provider: "youtube_data", observations: Object.freeze([]), discoverySignals: Object.freeze(signals), requestCount, quotaUnits: requestCount, estimatedCostUsd: 0 });
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
  if (provider === "naver_api_hub" || provider === "naver_shopping") return collectNaverApiHubTrends(keyword, options);
  if (provider === "youtube_data") return collectYouTubeVideoSignals(keyword, options);
  return collectDataForSeoNaverSignals(keyword, options);
}
