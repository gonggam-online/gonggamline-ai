import type { MarketObservationInput, MarketSource } from "../types/market";
import type { MarketDiscoverySignal } from "../shared/domain/market-discovery-evidence";
import { collectExternalMarketProvider, type ExternalMarketProvider, type ExternalProviderCredentials } from "../lib/market/external-provider-adapters";

export type MarketObservationCollectorKey = "official-api-adapter" | "public-observation-adapter";

export type MarketObservationCollectorResult = Readonly<{
  observations: readonly MarketObservationInput[];
  discoverySignals: readonly MarketDiscoverySignal[];
  endpoint: string;
  source: MarketSource;
}>;

type CollectorResponse = Readonly<{ observations?: unknown }>;

function sourceFor(key: MarketObservationCollectorKey): MarketSource {
  return key === "official-api-adapter" ? "naver_official" : "coupang_public";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function normalizeObservation(value: unknown, source: MarketSource, keyword: string): MarketObservationInput {
  if (!isRecord(value) || !isRecord(value.product) || !isRecord(value.snapshot)) {
    throw new Error("MARKET_OBSERVATION_INVALID");
  }
  const product = value.product;
  if (typeof product.externalProductId !== "string" || product.externalProductId.trim() === "" ||
      typeof product.title !== "string" || product.title.trim() === "") {
    throw new Error("MARKET_OBSERVATION_PRODUCT_INVALID");
  }
  const observedAt = value.observedAt;
  if (observedAt !== undefined && !isIsoDate(observedAt)) throw new Error("MARKET_OBSERVATION_TIME_INVALID");
  return {
    source,
    keyword,
    ...(observedAt === undefined ? {} : { observedAt }),
    product: {
      externalProductId: product.externalProductId,
      vendorItemId: typeof product.vendorItemId === "string" ? product.vendorItemId : null,
      url: typeof product.url === "string" ? product.url : null,
      title: product.title,
      brand: typeof product.brand === "string" ? product.brand : null,
      sellerName: typeof product.sellerName === "string" ? product.sellerName : null,
      category: typeof product.category === "string" ? product.category : null,
      thumbnailUrl: typeof product.thumbnailUrl === "string" ? product.thumbnailUrl : null,
    },
    snapshot: {
      rank: typeof value.snapshot.rank === "number" ? value.snapshot.rank : null,
      isAd: typeof value.snapshot.isAd === "boolean" ? value.snapshot.isAd : null,
      price: typeof value.snapshot.price === "number" ? value.snapshot.price : null,
      listPrice: typeof value.snapshot.listPrice === "number" ? value.snapshot.listPrice : null,
      rating: typeof value.snapshot.rating === "number" ? value.snapshot.rating : null,
      reviewCount: typeof value.snapshot.reviewCount === "number" ? value.snapshot.reviewCount : null,
      rocketType: typeof value.snapshot.rocketType === "string" ? value.snapshot.rocketType : null,
      isSoldOut: typeof value.snapshot.isSoldOut === "boolean" ? value.snapshot.isSoldOut : null,
      deliveryDays: typeof value.snapshot.deliveryDays === "number" ? value.snapshot.deliveryDays : null,
      optionCount: typeof value.snapshot.optionCount === "number" ? value.snapshot.optionCount : null,
    },
  };
}

export async function collectConfiguredMarketObservations(
  input: Readonly<{ collectorKey: MarketObservationCollectorKey; keyword: string; endpoint?: string; apiKey?: string; provider?: ExternalMarketProvider; credentials?: ExternalProviderCredentials; request?: typeof fetch; allowSignalOnly?: boolean }>,
): Promise<MarketObservationCollectorResult> {
  const keyword = input.keyword.trim();
  if (keyword.length < 2 || keyword.length > 100) throw new Error("MARKET_KEYWORD_INVALID");
  const nativeProvider = input.provider ?? (process.env.MARKET_EXTERNAL_PROVIDER as ExternalMarketProvider | undefined);
  if (!input.endpoint && nativeProvider) {
    if (!input.provider && process.env.MARKET_EXTERNAL_PROVIDER_ENABLED !== "true") throw new Error("MARKET_EXTERNAL_PROVIDER_DISABLED");
    if (nativeProvider === "youtube_data" && !input.allowSignalOnly) throw new Error("MARKET_PROVIDER_SIGNAL_ONLY");
    const external = await collectExternalMarketProvider(nativeProvider, keyword, { credentials: input.credentials, request: input.request });
    return Object.freeze({ observations: Object.freeze([...external.observations]), discoverySignals: Object.freeze([...external.discoverySignals]), endpoint: `native:${nativeProvider}`, source: nativeProvider === "dataforseo_naver" ? "dataforseo_naver" : "naver_official" });
  }
  const endpoint = (input.endpoint ?? process.env.COUPANG_MARKET_DATA_ENDPOINT)?.trim();
  if (!endpoint || !/^https:\/\//i.test(endpoint)) throw new Error("MARKET_COLLECTOR_ENDPOINT_UNAVAILABLE");
  const request = input.request ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await request(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...((input.apiKey ?? process.env.COUPANG_MARKET_DATA_API_KEY)?.trim()
          ? { Authorization: `Bearer ${(input.apiKey ?? process.env.COUPANG_MARKET_DATA_API_KEY)?.trim()}` }
          : {}),
      },
      body: JSON.stringify({ keyword, collectorKey: input.collectorKey }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (response.status === 403) throw new Error("MARKET_COLLECTOR_FORBIDDEN");
    if (response.status === 429) throw new Error("MARKET_COLLECTOR_RATE_LIMITED");
    if (!response.ok) throw new Error(`MARKET_COLLECTOR_HTTP_${response.status}`);
    const body = await response.json() as CollectorResponse;
    if (!Array.isArray(body.observations) || body.observations.length > 50) throw new Error("MARKET_COLLECTOR_RESPONSE_INVALID");
    const source = sourceFor(input.collectorKey);
    return Object.freeze({
      observations: Object.freeze(body.observations.map((observation) => normalizeObservation(observation, source, keyword))),
      discoverySignals: Object.freeze([]),
      endpoint,
      source,
    });
  } finally {
    clearTimeout(timeout);
  }
}
