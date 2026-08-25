export const COUPANG_MARKET_PRICE_ESTIMATE_VERSION =
  "gonggamline-coupang-public-market-price-2026-08-25-v3" as const;

export type CoupangMarketPriceEstimate = Readonly<{
  version: typeof COUPANG_MARKET_PRICE_ESTIMATE_VERSION;
  status: "AVAILABLE" | "UNAVAILABLE";
  matchType: "TITLE_MATCHED" | "KEYWORD_COMPARABLE" | "UNAVAILABLE";
  query: string;
  observedAt: string | null;
  predictedSellingPriceKrw: number | null;
  lowSellingPriceKrw: number | null;
  highSellingPriceKrw: number | null;
  observationCount: number;
  sourceReference: string | null;
  sampleOffers: readonly Readonly<{
    title: string;
    priceKrw: number;
    url: string | null;
    similarity: number;
  }>[];
}>;
