import { normalizeMarketConcept, type MarketOpportunity } from "./autonomous-intelligence";

export const ITEM_DISCOVERY_WORKBENCH_VERSION = "gonggamline-item-discovery-workbench-v1" as const;

export type FinderSignalRow = Readonly<{
  concept: string;
  provider: string;
  observedAt: string;
  demandIndex: number | null;
  contentVelocity: number | null;
  shoppingIntent: number | null;
  competitionPressure: number | null;
  priceRoom: number | null;
  evidence: Readonly<Record<string, unknown>>;
}>;

export type FinderPriceObservation = Readonly<{
  productId: number;
  title: string;
  source: string;
  url: string | null;
  price: number;
  rank: number | null;
  reviewCount: number | null;
  observedAt: string;
}>;

export type ShoppingContentCard = Readonly<{
  id: string;
  platform: "YOUTUBE" | "NAVER_SERP" | "MARKET_SIGNAL";
  keyword: string;
  title: string;
  sourceUrl: string | null;
  observedAt: string;
  channelTitle: string | null;
  thumbnailUrl: string | null;
  viewCount: number | null;
  contentVelocity: number | null;
  isShort: boolean | null;
  shoppingScore: number;
  verdict: "SHOPPING_CONTENT" | "PRODUCT_RELATED" | "REVIEW";
  extractedProduct: string;
  referenceOnly: true;
}>;

const numberOrNull = (value: unknown): number | null => {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

const stringOrNull = (value: unknown, max = 500): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFC").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, max) : null;
};

function shoppingScore(title: string, keyword: string, row: FinderSignalRow): number {
  const normalized = normalizeMarketConcept(title);
  const productTokens = ["정리", "수납", "청소", "세척", "선반", "트레이", "거치", "보관", "파우치", "케이스", "도구", "용품", "가방", "화장품", "추천", "비교", "리뷰", "언박싱"];
  const noiseTokens = ["브이로그", "먹방", "예능", "뮤직비디오", "뉴스", "게임", "챌린지"];
  let score = 24;
  if (normalized.includes(normalizeMarketConcept(keyword))) score += 28;
  score += Math.min(28, productTokens.filter((token) => normalized.includes(token)).length * 7);
  score += Math.min(12, Math.max(0, row.contentVelocity ?? 0) / 10);
  score -= noiseTokens.filter((token) => normalized.includes(token)).length * 18;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function extractProductPhrase(title: string, keyword: string): string {
  const cleaned = title.normalize("NFC")
    .replace(/\[[^\]]*]/g, " ")
    .replace(/\([^)]*(광고|협찬|리뷰|추천)[^)]*\)/gi, " ")
    .replace(/#\S+/g, " ")
    .replace(/(?:내돈내산|솔직리뷰|추천템|필수템|꿀템|언박싱|shorts?|쇼츠)/gi, " ")
    .replace(/[|/·:]+/g, " ")
    .replace(/\s+/g, " ").trim();
  if (cleaned.length >= 2 && cleaned.length <= 60) return cleaned;
  return `${keyword} 관련 상품`;
}

export function buildShoppingContentFeed(rows: readonly FinderSignalRow[], limit = 30): readonly ShoppingContentCard[] {
  const contentRows = rows.filter((row) => row.provider.includes("youtube") || row.provider.includes("dataforseo"));
  const cards = contentRows.flatMap((row, index): ShoppingContentCard[] => {
    const title = stringOrNull(row.evidence.title);
    if (!title) return [];
    const score = shoppingScore(title, row.concept, row);
    const sourceUrl = stringOrNull(row.evidence.sourceUrl, 2_000);
    const platform = row.provider.includes("youtube") ? "YOUTUBE" as const : row.provider.includes("dataforseo") ? "NAVER_SERP" as const : "MARKET_SIGNAL" as const;
    return [Object.freeze({
      id: `${row.provider}:${stringOrNull(row.evidence.externalProductId, 200) ?? index}:${row.observedAt}`,
      platform,
      keyword: row.concept,
      title,
      sourceUrl,
      observedAt: row.observedAt,
      channelTitle: stringOrNull(row.evidence.channelTitle, 300),
      thumbnailUrl: stringOrNull(row.evidence.thumbnailUrl, 2_000),
      viewCount: numberOrNull(row.evidence.viewCount),
      contentVelocity: row.contentVelocity,
      isShort: typeof row.evidence.isShort === "boolean" ? row.evidence.isShort : null,
      shoppingScore: score,
      verdict: score >= 68 ? "SHOPPING_CONTENT" : score >= 45 ? "PRODUCT_RELATED" : "REVIEW",
      extractedProduct: extractProductPhrase(title, row.concept),
      referenceOnly: true,
    })];
  });
  return Object.freeze(cards.sort((left, right) => right.shoppingScore - left.shoppingScore
    || (right.viewCount ?? 0) - (left.viewCount ?? 0)
    || Date.parse(right.observedAt) - Date.parse(left.observedAt)
    || left.id.localeCompare(right.id)).filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index)
    .slice(0, Math.max(1, Math.min(100, limit))));
}

export function buildKeywordFinderProfiles(input: Readonly<{
  opportunities: readonly MarketOpportunity[];
  signals: readonly FinderSignalRow[];
  prices: readonly FinderPriceObservation[];
}>): readonly Record<string, unknown>[] {
  return Object.freeze(input.opportunities.map((opportunity) => {
    const signals = input.signals.filter((row) => normalizeMarketConcept(row.concept) === opportunity.concept);
    const prices = input.prices.filter((row) => normalizeMarketConcept(row.title).includes(opportunity.concept));
    const priceValues = prices.map((row) => row.price).filter((value) => value > 0).sort((a, b) => a - b);
    const monthGroups = new Map<string, number[]>();
    for (const row of signals) {
      if (row.demandIndex === null) continue;
      const month = row.observedAt.slice(0, 7);
      monthGroups.set(month, [...(monthGroups.get(month) ?? []), row.demandIndex]);
    }
    const seasonality = [...monthGroups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([month, values]) => ({
      month,
      demandIndex: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
      evidenceCount: values.length,
    }));
    const content = buildShoppingContentFeed(signals, 100);
    const youtube = content.filter((item) => item.platform === "YOUTUBE");
    return Object.freeze({
      keyword: opportunity.concept,
      state: opportunity.state,
      lane: opportunity.lane,
      score: opportunity.score,
      confidence: opportunity.confidence,
      demand: opportunity.demand,
      momentum: opportunity.momentum,
      shoppingIntent: opportunity.shoppingIntent,
      contentVelocity: opportunity.contentVelocity,
      competitionHeadroom: opportunity.competitionHeadroom,
      sourceAgreement: opportunity.sourceAgreement,
      providers: opportunity.providers,
      seasonality,
      seasonalityStatus: seasonality.length >= 12 ? "TWELVE_MONTHS" : seasonality.length >= 3 ? "BUILDING" : "INSUFFICIENT_HISTORY",
      priceBenchmark: priceValues.length ? {
        sampleCount: priceValues.length,
        minimum: priceValues[0],
        median: priceValues[Math.floor(priceValues.length / 2)],
        maximum: priceValues.at(-1),
      } : null,
      youtubeLandscape: {
        sampleCount: youtube.length,
        shortsRatio: youtube.length ? Math.round(youtube.filter((item) => item.isShort).length / youtube.length * 100) : null,
        medianViews: youtube.map((item) => item.viewCount).filter((value): value is number => value !== null).sort((a, b) => a - b)[Math.floor(youtube.filter((item) => item.viewCount !== null).length / 2)] ?? null,
        shoppingContentCount: youtube.filter((item) => item.verdict === "SHOPPING_CONTENT").length,
      },
    });
  }));
}
