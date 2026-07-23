export type MarketSource = "coupang_public" | "naver_official" | "manual" | "internal_sales";
export type CollectionStatus = "active" | "paused" | "cooldown" | "blocked";

export type MarketKeyword = {
  id: number;
  keyword: string;
  category: string | null;
  priority: number;
  collection_status: CollectionStatus;
  collection_interval_minutes: number;
  last_collected_at: string | null;
  next_collection_at: string | null;
  result_count: number | null;
  demand_score: number | null;
  competition_score: number | null;
  opportunity_score: number | null;
};

export type MarketObservationInput = {
  source: MarketSource;
  keyword: string;
  observedAt?: string;
  product: {
    externalProductId: string;
    vendorItemId?: string | null;
    url?: string | null;
    title: string;
    brand?: string | null;
    sellerName?: string | null;
    category?: string | null;
    thumbnailUrl?: string | null;
  };
  snapshot: {
    rank?: number | null;
    isAd?: boolean | null;
    price?: number | null;
    listPrice?: number | null;
    rating?: number | null;
    reviewCount?: number | null;
    rocketType?: string | null;
    isSoldOut?: boolean | null;
    deliveryDays?: number | null;
    optionCount?: number | null;
  };
};
