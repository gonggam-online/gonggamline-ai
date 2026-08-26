import { normalizeMarketConcept } from "./autonomous-intelligence";

export const DISCOVERY_PORTFOLIO_VERSION = "gonggamline-discovery-portfolio-v1" as const;

export type DiscoveryPortfolioLane = "SCALE_READY" | "VALIDATE_NEXT" | "WATCH";

export type TrendDiscoveryCandidate = Readonly<{
  candidateId: string;
  title: string;
  form: string;
  score: number;
  confidence: number;
  trendState: string;
  concept: string;
  reasons: readonly string[];
  unresolved: readonly string[];
}>;

export type EvaluatedDiscoveryCandidate = Readonly<{
  id: number;
  status: string;
  decision_action: "approve" | "review" | "hold" | "reject";
  decision_score: number;
  market_score: number;
  growth_score: number;
  supply_score: number;
  profit_score: number;
  risk_score: number;
  confidence: number;
  estimated_units_low: number;
  estimated_units_high: number;
  recommendation_reason: string;
  risk_explanation: string;
  market_products: Readonly<{ title: string; category: string | null; brand: string | null; thumbnail_url: string | null }> | null;
}>;

export type DiscoveryPortfolioCandidate = Readonly<{
  id: string;
  source: "MARKET_TREND" | "EVALUATED_PRODUCT";
  title: string;
  concept: string;
  form: string;
  priorityScore: number;
  marketScore: number;
  growthScore: number;
  profitScore: number;
  scaleScore: number;
  readinessScore: number;
  riskScore: number;
  confidence: number;
  lane: DiscoveryPortfolioLane;
  estimatedUnitsLow: number | null;
  estimatedUnitsHigh: number | null;
  reasons: readonly string[];
  unresolved: readonly string[];
  thumbnailUrl: string | null;
  recommendationId: number | null;
}>;

const finite = (value: number, fallback = 0) => Number.isFinite(value) ? value : fallback;
const bounded = (value: number) => Math.round(Math.max(0, Math.min(100, value)) * 10) / 10;

function lane(score: number, confidence: number, profit: number, risk: number, readiness: number): DiscoveryPortfolioLane {
  if (score >= 72 && confidence >= 58 && profit >= 52 && risk <= 55 && readiness >= 55) return "SCALE_READY";
  if (score >= 52 && risk <= 75) return "VALIDATE_NEXT";
  return "WATCH";
}

function isDemoProduct(candidate: EvaluatedDiscoveryCandidate): boolean {
  const haystack = `${candidate.market_products?.category ?? ""} ${candidate.market_products?.brand ?? ""}`.toLocaleLowerCase("ko");
  return haystack.includes("데모") || haystack.includes("demo");
}

function fromTrend(candidate: TrendDiscoveryCandidate): DiscoveryPortfolioCandidate {
  const marketScore = bounded(finite(candidate.score));
  const growthScore = bounded(candidate.trendState === "BREAKOUT" ? 92 : candidate.trendState === "RISING" ? 82 : candidate.trendState === "PERSISTENT" ? 68 : 48);
  const confidence = bounded(finite(candidate.confidence));
  const missing = new Set(candidate.unresolved);
  const profitScore = missing.has("PROFITABILITY_EVIDENCE") || missing.has("UNIT_ECONOMICS") ? 32 : 58;
  const readinessScore = bounded(82 - missing.size * 11);
  const scaleScore = bounded(marketScore * .55 + growthScore * .30 + (candidate.form === "bundle" ? 10 : 5));
  const riskScore = bounded(100 - confidence * .55 - readinessScore * .25 + missing.size * 5);
  const priorityScore = bounded(marketScore * .30 + growthScore * .15 + profitScore * .18 + scaleScore * .22 + readinessScore * .10 + (100 - riskScore) * .05);
  return Object.freeze({
    id: `trend:${candidate.candidateId}`, source: "MARKET_TREND", title: candidate.title, concept: candidate.concept,
    form: candidate.form, priorityScore, marketScore, growthScore, profitScore, scaleScore, readinessScore, riskScore, confidence,
    lane: lane(priorityScore, confidence, profitScore, riskScore, readinessScore), estimatedUnitsLow: null, estimatedUnitsHigh: null,
    reasons: Object.freeze([...candidate.reasons]), unresolved: Object.freeze([...candidate.unresolved]), thumbnailUrl: null, recommendationId: null,
  });
}

function fromEvaluated(candidate: EvaluatedDiscoveryCandidate): DiscoveryPortfolioCandidate {
  const marketScore = bounded(finite(candidate.market_score));
  const growthScore = bounded(finite(candidate.growth_score));
  const profitScore = bounded(finite(candidate.profit_score));
  const confidence = bounded(finite(candidate.confidence));
  const riskScore = bounded(finite(candidate.risk_score, 100));
  const readinessScore = bounded(finite(candidate.supply_score) * .55 + confidence * .45);
  const highUnits = Math.max(0, finite(candidate.estimated_units_high));
  const scaleScore = bounded(Math.sqrt(Math.min(2_500, highUnits) / 2_500) * 100);
  const priorityScore = bounded(marketScore * .20 + growthScore * .14 + profitScore * .20 + scaleScore * .21 + readinessScore * .15 + (100 - riskScore) * .10);
  return Object.freeze({
    id: `product:${candidate.id}`, source: "EVALUATED_PRODUCT", title: candidate.market_products?.title ?? `상품 후보 ${candidate.id}`,
    concept: normalizeMarketConcept(candidate.market_products?.title ?? "상품 후보"), form: "single", priorityScore, marketScore, growthScore,
    profitScore, scaleScore, readinessScore, riskScore, confidence, lane: lane(priorityScore, confidence, profitScore, riskScore, readinessScore),
    estimatedUnitsLow: Math.max(0, finite(candidate.estimated_units_low)), estimatedUnitsHigh: highUnits,
    reasons: Object.freeze([candidate.recommendation_reason].filter(Boolean)), unresolved: Object.freeze([candidate.risk_explanation].filter(Boolean)),
    thumbnailUrl: candidate.market_products?.thumbnail_url ?? null, recommendationId: candidate.id,
  });
}

export function rankDiscoveryPortfolio(input: Readonly<{
  trends: readonly TrendDiscoveryCandidate[];
  evaluated: readonly EvaluatedDiscoveryCandidate[];
}>): readonly DiscoveryPortfolioCandidate[] {
  const evaluated = input.evaluated.filter((item) => !isDemoProduct(item)).map(fromEvaluated);
  const evaluatedConcepts = new Set(evaluated.map((item) => normalizeMarketConcept(item.concept)));
  const trends = input.trends.map(fromTrend).filter((item) => !evaluatedConcepts.has(normalizeMarketConcept(item.concept)));
  return Object.freeze([...evaluated, ...trends].sort((left, right) =>
    right.priorityScore - left.priorityScore || right.confidence - left.confidence || left.id.localeCompare(right.id)));
}
