export function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

export function calculateConfidence(input: {
  observationDays: number;
  observations: number;
  hasRank: boolean;
  hasReviews: boolean;
  hasStock: boolean;
  hasPrice: boolean;
}) {
  const coverage = Math.min(35, input.observationDays * 1.2);
  const volume = Math.min(25, input.observations * 0.7);
  const signal = [input.hasRank, input.hasReviews, input.hasStock, input.hasPrice].filter(Boolean).length * 10;
  return Math.round(clamp(coverage + volume + signal));
}

export function estimateMonthlyUnits(input: {
  reviewDelta30d: number;
  averageRank: number | null;
  stockoutCount30d: number;
  confidence: number;
}) {
  const reviewDriven = Math.max(0, input.reviewDelta30d) * 24;
  const rankMultiplier = input.averageRank == null ? 0.75 : clamp(1.55 - input.averageRank / 60, 0.45, 1.5);
  const stockSignal = input.stockoutCount30d * 18;
  const base = Math.round(reviewDriven * rankMultiplier + stockSignal);
  const uncertainty = 0.55 - Math.min(0.35, input.confidence / 250);
  return {
    low: Math.max(0, Math.round(base * (1 - uncertainty))),
    base,
    high: Math.round(base * (1 + uncertainty)),
  };
}
