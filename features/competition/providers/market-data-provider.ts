export type MarketData = {
  keyword: string;
  marketPrice: number;
  top10AveragePrice: number;
  resultCount: number;
  rocketRatio: number;
  averageReviewCount: number;
  averageRating: number;
  monthlySearchVolume: number;
  source: "external" | "estimated";
  confidence: number;
  collectedAt: string;
  note: string;
};

export type MarketDataProduct = {
  id: number;
  title: string;
  keyword: string | null;
  supply_price: number;
  estimated_sale_price: number;
  basic_score: number;
  margin_rate: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hash(text: string) {
  let value = 2166136261;
  for (const char of text) {
    value ^= char.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return Math.abs(value >>> 0);
}

function deriveKeyword(product: MarketDataProduct) {
  const explicit = product.keyword?.trim();
  if (explicit) return explicit;
  return product.title
    .replace(/[0-9]+(?:개|매|세트|팩|cm|mm|kg|g|ml|L)?/gi, " ")
    .replace(/[^가-힣a-zA-Z\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2)
    .slice(0, 3)
    .join(" ") || product.title.slice(0, 24);
}

async function fetchExternal(product: MarketDataProduct): Promise<MarketData | null> {
  const endpoint = process.env.COUPANG_MARKET_DATA_ENDPOINT?.trim();
  if (!endpoint) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.COUPANG_MARKET_DATA_API_KEY
          ? { Authorization: `Bearer ${process.env.COUPANG_MARKET_DATA_API_KEY}` }
          : {}),
      },
      body: JSON.stringify({
        productId: product.id,
        title: product.title,
        keyword: deriveKeyword(product),
        expectedSalePrice: product.estimated_sale_price,
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`외부 시장 데이터 응답 오류: ${response.status}`);
    const raw = await response.json();
    const required = [
      "marketPrice", "top10AveragePrice", "resultCount", "rocketRatio",
      "averageReviewCount", "averageRating", "monthlySearchVolume",
    ];
    for (const field of required) {
      if (!Number.isFinite(Number(raw[field]))) throw new Error(`외부 시장 데이터 필드 누락: ${field}`);
    }
    return {
      keyword: String(raw.keyword || deriveKeyword(product)),
      marketPrice: Number(raw.marketPrice),
      top10AveragePrice: Number(raw.top10AveragePrice),
      resultCount: Math.max(0, Math.round(Number(raw.resultCount))),
      rocketRatio: clamp(Number(raw.rocketRatio), 0, 100),
      averageReviewCount: Math.max(0, Number(raw.averageReviewCount)),
      averageRating: clamp(Number(raw.averageRating), 0, 5),
      monthlySearchVolume: Math.max(0, Math.round(Number(raw.monthlySearchVolume))),
      source: "external",
      confidence: clamp(Number(raw.confidence ?? 85), 0, 100),
      collectedAt: new Date().toISOString(),
      note: String(raw.note || "설정된 외부 시장 데이터 공급원에서 수집"),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function estimate(product: MarketDataProduct): MarketData {
  const seed = hash(`${product.title}|${product.keyword ?? ""}`);
  const score = clamp(Number(product.basic_score || 50), 0, 100);
  const salePrice = Math.max(1000, Number(product.estimated_sale_price || product.supply_price * 1.8));
  const priceFactor = 0.88 + ((seed % 21) / 100);
  const top10Factor = 0.92 + (((seed >> 4) % 18) / 100);
  const resultCount = Math.round(250 + (seed % 4750) + (100 - score) * 16);
  const rocketRatio = clamp(20 + ((seed >> 7) % 61), 8, 92);
  const averageReviewCount = Math.round(20 + ((seed >> 11) % 980));
  const averageRating = Math.round((4.0 + ((seed >> 15) % 10) / 10) * 10) / 10;
  const monthlySearchVolume = Math.round(500 + score * 55 + ((seed >> 19) % 5500));
  return {
    keyword: deriveKeyword(product),
    marketPrice: Math.round(salePrice * priceFactor / 100) * 100,
    top10AveragePrice: Math.round(salePrice * top10Factor / 100) * 100,
    resultCount,
    rocketRatio,
    averageReviewCount,
    averageRating,
    monthlySearchVolume,
    source: "estimated",
    confidence: 35,
    collectedAt: new Date().toISOString(),
    note: "실제 쿠팡 데이터가 아닌 내부 추정치입니다. 외부 데이터 공급원을 연결하면 실데이터 분석으로 전환됩니다.",
  };
}

export async function collectMarketData(product: MarketDataProduct): Promise<MarketData> {
  try {
    return (await fetchExternal(product)) ?? estimate(product);
  } catch (error) {
    console.error("외부 시장 데이터 수집 실패, 추정 모드로 전환:", error);
    return estimate(product);
  }
}
