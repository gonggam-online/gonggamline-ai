import { createHash } from "node:crypto";

export const MARKET_INTELLIGENCE_VERSION = "market-opportunity-v1";

export type TrendState =
  | "BREAKOUT"
  | "RISING"
  | "PERSISTENT"
  | "SEASONAL_APPROACHING"
  | "SATURATED"
  | "DECLINING"
  | "INSUFFICIENT_EVIDENCE";

export type RecommendationLane =
  | "DISCOVER_NOW"
  | "VALIDATE_ECONOMICS"
  | "WATCH_TREND"
  | "SATURATED_OR_DECLINING"
  | "QUARANTINED";

export type MarketTrendEvidence = Readonly<{
  concept: string;
  provider: string;
  observedAt: string;
  demandIndex?: number | null;
  contentVelocity?: number | null;
  competitionPressure?: number | null;
  priceRoom?: number | null;
  shoppingIntent?: number | null;
  evidenceId: string;
}>;

export type MarketOpportunity = Readonly<{
  concept: string;
  state: TrendState;
  lane: RecommendationLane;
  score: number;
  confidence: number;
  demand: number;
  momentum: number;
  acceleration: number;
  persistence: number;
  shoppingIntent: number;
  contentVelocity: number;
  competitionHeadroom: number;
  priceRoom: number;
  sourceAgreement: number;
  providers: readonly string[];
  evidenceIds: readonly string[];
  asOf: string;
  reasons: readonly string[];
}>;

export type MarketTrendDigest = Readonly<{
  version: typeof MARKET_INTELLIGENCE_VERSION;
  asOf: string;
  status: "COMPLETE" | "PARTIAL" | "EMPTY";
  opportunities: readonly MarketOpportunity[];
  digest: string;
}>;

export type MarketProductCandidateInput = Readonly<{
  id: number;
  title: string;
  category?: string | null;
  source?: string | null;
  opportunityScore?: number | null;
  confidence?: number | null;
}>;

export type MarketItemRecommendation = Readonly<{
  candidateId: string;
  marketProductIds: readonly number[];
  title: string;
  form: "single" | "set" | "bundle";
  lane: RecommendationLane;
  score: number;
  confidence: number;
  trendState: TrendState;
  concept: string;
  reasons: readonly string[];
  unresolved: readonly string[];
}>;

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value * 100) / 100));
const finite = (value: number | null | undefined, fallback = 0) => Number.isFinite(value) ? Number(value) : fallback;

export function normalizeMarketConcept(value: string): string {
  return value.normalize("NFC").toLowerCase().replace(/<[^>]*>/g, " ")
    .replace(/[^0-9a-z가-힣\s]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function median(values: readonly number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function classify(input: Readonly<{
  evidenceCount: number;
  providerCount: number;
  demand: number;
  momentum: number;
  acceleration: number;
  persistence: number;
  competitionHeadroom: number;
}>): TrendState {
  if (input.evidenceCount < 2 || input.providerCount < 2) return "INSUFFICIENT_EVIDENCE";
  if (input.momentum <= -10) return "DECLINING";
  if (input.demand >= 55 && input.competitionHeadroom <= 25) return "SATURATED";
  if (input.acceleration >= 18 && input.momentum >= 12) return "BREAKOUT";
  if (input.momentum >= 8 && input.persistence >= 40) return "RISING";
  if (input.demand >= 55 && input.persistence >= 60) return "PERSISTENT";
  return "SEASONAL_APPROACHING";
}

function laneFor(state: TrendState, score: number, confidence: number): RecommendationLane {
  if (state === "INSUFFICIENT_EVIDENCE") return "WATCH_TREND";
  if (state === "SATURATED" || state === "DECLINING") return "SATURATED_OR_DECLINING";
  if (score >= 68 && confidence >= 55) return "DISCOVER_NOW";
  return "VALIDATE_ECONOMICS";
}

export function buildMarketTrendDigest(
  evidence: readonly MarketTrendEvidence[],
  options: Readonly<{ now?: Date; expectedProviders?: number; limit?: number }> = {},
): MarketTrendDigest {
  const asOf = (options.now ?? new Date()).toISOString();
  const expectedProviders = Math.max(1, options.expectedProviders ?? 3);
  const grouped = new Map<string, MarketTrendEvidence[]>();
  for (const item of evidence) {
    const concept = normalizeMarketConcept(item.concept);
    if (concept.length < 2 || !Number.isFinite(Date.parse(item.observedAt))) continue;
    grouped.set(concept, [...(grouped.get(concept) ?? []), { ...item, concept }]);
  }

  const opportunities = [...grouped.entries()].map(([concept, rows]): MarketOpportunity => {
    const ordered = [...rows].sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt) || a.evidenceId.localeCompare(b.evidenceId));
    const demandValues = ordered.map((item) => clamp(finite(item.demandIndex))).filter((value) => value > 0);
    const recent = demandValues.slice(-3);
    const previous = demandValues.slice(-6, -3);
    const demand = clamp(median(recent.length ? recent : demandValues));
    const recentAverage = median(recent);
    const previousAverage = median(previous.length ? previous : demandValues.slice(0, Math.max(1, demandValues.length - recent.length)));
    const momentum = Math.max(-100, Math.min(100, Math.round((recentAverage - previousAverage) * 100) / 100));
    const earlier = demandValues.length >= 3 ? demandValues.at(-3) ?? 0 : demandValues[0] ?? 0;
    const acceleration = Math.max(-100, Math.min(100, Math.round(((demandValues.at(-1) ?? 0) - earlier - momentum) * 100) / 100));
    const positiveWindows = demandValues.slice(1).filter((value, index) => value >= demandValues[index]).length;
    const persistence = demandValues.length <= 1 ? 0 : clamp(positiveWindows / (demandValues.length - 1) * 100);
    const contentVelocity = clamp(median(ordered.map((item) => finite(item.contentVelocity)).filter((value) => value > 0)));
    const competitionPressure = clamp(median(ordered.map((item) => finite(item.competitionPressure, 50))));
    const competitionHeadroom = clamp(100 - competitionPressure);
    const priceRoom = clamp(median(ordered.map((item) => finite(item.priceRoom, 50))));
    const shoppingIntent = clamp(median(ordered.map((item) => finite(item.shoppingIntent, item.provider.includes("shopping") ? demand : 0)).filter((value) => value > 0)));
    const providers = [...new Set(ordered.map((item) => item.provider))].sort();
    const directions = providers.map((provider) => {
      const values = ordered.filter((item) => item.provider === provider).map((item) => finite(item.demandIndex));
      return Math.sign((values.at(-1) ?? 0) - (values[0] ?? 0));
    }).filter((value) => value !== 0);
    const agreement = directions.length < 2 ? 40 : clamp(Math.max(
      directions.filter((value) => value > 0).length,
      directions.filter((value) => value < 0).length,
    ) / directions.length * 100);
    const coverage = clamp(providers.length / expectedProviders * 100);
    const latestTime = Math.max(...ordered.map((item) => Date.parse(item.observedAt)));
    const ageHours = Math.max(0, (Date.parse(asOf) - latestTime) / 3_600_000);
    const freshness = ageHours <= 24 ? 100 : ageHours <= 72 ? 75 : ageHours <= 168 ? 45 : 15;
    const confidence = clamp((coverage * 0.45 + freshness * 0.35 + agreement * 0.20));
    const scoreBase = demand * .22 + clamp(momentum + 50) * .18 + clamp(acceleration + 50) * .10
      + persistence * .10 + shoppingIntent * .12 + contentVelocity * .08
      + competitionHeadroom * .10 + priceRoom * .05 + agreement * .05;
    const score = clamp(scoreBase * (0.55 + confidence / 100 * 0.45));
    const state = classify({ evidenceCount: ordered.length, providerCount: providers.length, demand, momentum, acceleration, persistence, competitionHeadroom });
    const reasons = [
      `${providers.length}개 출처 · 근거 ${ordered.length}건`,
      `수요 ${Math.round(demand)} · 모멘텀 ${Math.round(momentum)}`,
      `경쟁 여지 ${Math.round(competitionHeadroom)} · 신뢰도 ${Math.round(confidence)}`,
    ];
    return Object.freeze({
      concept, state, lane: laneFor(state, score, confidence), score, confidence,
      demand, momentum, acceleration, persistence, shoppingIntent, contentVelocity,
      competitionHeadroom, priceRoom, sourceAgreement: agreement, providers,
      evidenceIds: ordered.map((item) => item.evidenceId).sort(), asOf, reasons,
    });
  }).sort((a, b) => b.score - a.score || b.confidence - a.confidence || a.concept.localeCompare(b.concept, "ko"))
    .slice(0, Math.max(1, options.limit ?? 20));

  const status = opportunities.length === 0 ? "EMPTY" : opportunities.some((item) => item.providers.length < expectedProviders) ? "PARTIAL" : "COMPLETE";
  const payload = { version: MARKET_INTELLIGENCE_VERSION, asOf, status, opportunities } as const;
  return Object.freeze({ ...payload, digest: digest(payload) });
}

export function extractBoundedMarketPhrases(titles: readonly string[], existing: readonly string[], limit = 10): readonly string[] {
  const blocked = new Set(["쿠팡", "네이버", "추천", "인기", "상품", "제품", "구매", "리뷰", "사용", "가격", "통합검색", "추이", "쇼핑", "클릭", "검색", "영상"]);
  const known = new Set(existing.map(normalizeMarketConcept));
  const counts = new Map<string, number>();
  for (const title of titles) {
    const tokens = normalizeMarketConcept(title).split(" ").filter((token) => token.length >= 2 && token.length <= 20 && !blocked.has(token) && !/^\d+$/.test(token));
    for (const token of new Set(tokens)) counts.set(token, (counts.get(token) ?? 0) + 1);
    for (let index = 0; index < tokens.length - 1; index += 1) {
      const phrase = `${tokens[index]} ${tokens[index + 1]}`;
      if (phrase.length <= 30) counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
    }
  }
  return Object.freeze([...counts.entries()].filter(([phrase, count]) => count >= 2 && !known.has(phrase))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko")).slice(0, Math.max(0, Math.min(10, limit))).map(([phrase]) => phrase));
}

export function buildMarketItemRecommendations(
  opportunities: readonly MarketOpportunity[],
  products: readonly MarketProductCandidateInput[],
  limit = 20,
): readonly MarketItemRecommendation[] {
  const recommendations: MarketItemRecommendation[] = [];
  for (const opportunity of opportunities) {
    if (opportunity.state === "DECLINING" || opportunity.state === "SATURATED") continue;
    const conceptTokens = normalizeMarketConcept(opportunity.concept).split(" ").filter((token) => token.length >= 2);
    const matching = products.filter((product) => {
      if (normalizeMarketConcept(product.source ?? "").includes("demo")) return false;
      const title = normalizeMarketConcept(product.title);
      const compactTitle = title.replaceAll(" ", "");
      const compactConcept = opportunity.concept.replaceAll(" ", "");
      return compactTitle.includes(compactConcept) || conceptTokens.some((token) => title.includes(token));
    }).sort((left, right) => finite(right.opportunityScore) - finite(left.opportunityScore)
      || finite(right.confidence) - finite(left.confidence) || left.id - right.id).slice(0, 4);
    if (matching.length === 0) {
      recommendations.push(Object.freeze({
        candidateId: `concept:${normalizeMarketConcept(opportunity.concept).replaceAll(" ", "-")}`,
        marketProductIds: Object.freeze([]),
        title: `${opportunity.concept} 상품군 후보`,
        form: "set",
        lane: opportunity.lane,
        score: opportunity.score,
        confidence: opportunity.confidence,
        trendState: opportunity.state,
        concept: opportunity.concept,
        reasons: Object.freeze([...opportunity.reasons, "유효 수요 신호를 실제 판매상품 탐색 과제로 전환"]),
        unresolved: Object.freeze(["SOURCE_PRODUCT_MATCH", "SUPPLIER_QUOTE", "UNIT_ECONOMICS", "RIGHTS", "FULFILLMENT_COST"]),
      }));
    }
    for (const product of matching) {
      const productScore = finite(product.opportunityScore, opportunity.score);
      const score = clamp(opportunity.score * .65 + productScore * .35);
      const confidence = clamp(Math.min(opportunity.confidence, finite(product.confidence, opportunity.confidence)));
      recommendations.push(Object.freeze({
        candidateId: `single:${product.id}`,
        marketProductIds: Object.freeze([product.id]),
        title: product.title,
        form: "single",
        lane: opportunity.lane,
        score,
        confidence,
        trendState: opportunity.state,
        concept: opportunity.concept,
        reasons: Object.freeze([...opportunity.reasons, "실제 관측 상품과 시장 수요 개념이 일치"]),
        unresolved: Object.freeze(["SUPPLIER_QUOTE", "UNIT_ECONOMICS", "RIGHTS", "FULFILLMENT_COST"]),
      }));
    }
    if (matching.length >= 2) {
      const [anchor, complement] = matching;
      recommendations.push(Object.freeze({
        candidateId: `bundle:${anchor.id}:${complement.id}`,
        marketProductIds: Object.freeze([anchor.id, complement.id]),
        title: `${anchor.title} + ${complement.title}`,
        form: "bundle",
        lane: opportunity.lane === "DISCOVER_NOW" ? "VALIDATE_ECONOMICS" : opportunity.lane,
        score: clamp(opportunity.score * .90),
        confidence: clamp(opportunity.confidence * .85),
        trendState: opportunity.state,
        concept: opportunity.concept,
        reasons: Object.freeze([...opportunity.reasons, "동일 수요 개념의 관측 상품 조합 후보"]),
        unresolved: Object.freeze(["BUNDLE_COMPATIBILITY", "SUPPLIER_QUOTE", "UNIT_ECONOMICS", "RIGHTS", "FULFILLMENT_COST"]),
      }));
    }
  }
  return Object.freeze(recommendations.sort((a, b) => b.score - a.score || b.confidence - a.confidence || a.candidateId.localeCompare(b.candidateId))
    .filter((item, index, all) => all.findIndex((candidate) => candidate.candidateId === item.candidateId) === index)
    .slice(0, Math.max(1, Math.min(20, limit))));
}
