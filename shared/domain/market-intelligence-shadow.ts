export const MARKET_INTELLIGENCE_SHADOW_VERSION =
  "gonggamline-market-intelligence-shadow-v1" as const;

export type ShadowDecision =
  | "PRIORITIZE_FOR_REVIEW"
  | "WATCH"
  | "DO_NOT_PRIORITIZE";

export type ShadowEligibility =
  | "SHADOW_CANDIDATE"
  | "INSUFFICIENT_DATA"
  | "BLOCKED";

export type MarketIntelligenceMetricSnapshot = Readonly<{
  observedAt: string;
  source: "coupang_public" | "naver_official" | "youtube_public" | "dataforseo_naver" | "manual" | "internal_sales";
  opportunityScore: number | null;
  demandScore: number | null;
  growthScore: number | null;
  competitionScore: number | null;
  supplyScore: number | null;
  adBurdenScore: number | null;
  entryDifficultyScore: number | null;
  confidence: number | null;
  dataCompletenessScore: number | null;
  estimatedUnitsBase: number | null;
}>;

export type MarketIntelligenceShadowInput = Readonly<{
  providerItemNumber: string;
  market: MarketIntelligenceMetricSnapshot;
  profitabilityStatus: "CONFIRMED" | "ESTIMATED" | "INCOMPLETE" | "NOT_EVALUATED";
  contributionMarginRate: number | null;
  rightsStatus: "PASS" | "UNKNOWN" | "FAIL";
}>;

export type MarketIntelligenceShadowResult = Readonly<{
  version: typeof MARKET_INTELLIGENCE_SHADOW_VERSION;
  providerItemNumber: string;
  eligibility: ShadowEligibility;
  decision: ShadowDecision;
  marketScore: number | null;
  confidenceAdjustedScore: number | null;
  scoreCoverage: number;
  freshnessScore: number;
  riskScore: number | null;
  confidence: number;
  reasons: readonly string[];
  missingFacts: readonly string[];
  estimatedUnitsBase: number | null;
}>;

const MAX_OBSERVATION_AGE_DAYS = 14;
const MIN_CONFIDENCE = 45;
const MIN_COVERAGE = 0.75;

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function finiteOrNull(value: number | null): number | null {
  return value !== null && Number.isFinite(value) ? value : null;
}

function freshness(observedAt: string, now: Date): number {
  const timestamp = Date.parse(observedAt);
  if (!Number.isFinite(timestamp)) return 0;
  const ageDays = Math.max(0, (now.getTime() - timestamp) / 86_400_000);
  return clamp(100 - (ageDays / MAX_OBSERVATION_AGE_DAYS) * 100);
}

function rounded(value: number): number {
  return Math.round(value * 100) / 100;
}

function missingFacts(input: MarketIntelligenceShadowInput, coverage: number): string[] {
  const missing: string[] = [];
  const market = input.market;
  for (const [name, value] of Object.entries({
    opportunityScore: market.opportunityScore,
    demandScore: market.demandScore,
    growthScore: market.growthScore,
    competitionScore: market.competitionScore,
    supplyScore: market.supplyScore,
    confidence: market.confidence,
    dataCompletenessScore: market.dataCompletenessScore,
  })) {
    if (value === null) missing.push(`market.${name}`);
  }
  if (input.profitabilityStatus !== "CONFIRMED") missing.push("profitability.confirmed");
  if (input.contributionMarginRate === null) missing.push("profitability.contributionMarginRate");
  if (input.rightsStatus !== "PASS") missing.push("rights.pass");
  if (coverage < MIN_COVERAGE) missing.push("market.scoreCoverage");
  return missing.sort();
}

/**
 * Produces a read-only, evidence-gated market ranking signal.
 * It is intentionally separate from the live Item Selection verdict: no
 * missing market fact is replaced with a default and no commerce action is
 * authorized by this function.
 */
export function evaluateMarketIntelligenceShadow(
  input: MarketIntelligenceShadowInput,
  now = new Date(),
): MarketIntelligenceShadowResult {
  if (!/^\d{1,20}$/.test(input.providerItemNumber)) {
    throw new RangeError("providerItemNumber must contain 1 to 20 digits.");
  }

  const market = input.market;
  const fields = [
    market.opportunityScore,
    market.demandScore,
    market.growthScore,
    market.competitionScore,
    market.supplyScore,
    market.adBurdenScore,
    market.entryDifficultyScore,
    market.confidence,
    market.dataCompletenessScore,
  ].map(finiteOrNull);
  const available = fields.filter((value) => value !== null).length;
  const scoreCoverage = rounded(available / fields.length);
  const freshnessScore = rounded(freshness(market.observedAt, now));
  const confidence = rounded(clamp(
    (market.confidence ?? 0) * 0.55 +
      (market.dataCompletenessScore ?? 0) * 0.25 +
      freshnessScore * 0.2,
  ));
  const missing = missingFacts(input, scoreCoverage);

  if (input.rightsStatus === "FAIL") {
    return {
      version: MARKET_INTELLIGENCE_SHADOW_VERSION,
      providerItemNumber: input.providerItemNumber,
      eligibility: "BLOCKED",
      decision: "DO_NOT_PRIORITIZE",
      marketScore: null,
      confidenceAdjustedScore: null,
      scoreCoverage,
      freshnessScore,
      riskScore: 100,
      confidence,
      reasons: ["권리 하드게이트가 실패해 시장 점수와 무관하게 차단했습니다."],
      missingFacts: missing,
      estimatedUnitsBase: finiteOrNull(market.estimatedUnitsBase),
    };
  }

  const requiredScores = [
    market.opportunityScore,
    market.demandScore,
    market.growthScore,
    market.competitionScore,
    market.supplyScore,
    market.adBurdenScore,
    market.entryDifficultyScore,
  ];
  if (requiredScores.some((value) => finiteOrNull(value) === null)) {
    return {
      version: MARKET_INTELLIGENCE_SHADOW_VERSION,
      providerItemNumber: input.providerItemNumber,
      eligibility: "INSUFFICIENT_DATA",
      decision: "DO_NOT_PRIORITIZE",
      marketScore: null,
      confidenceAdjustedScore: null,
      scoreCoverage,
      freshnessScore,
      riskScore: null,
      confidence,
      reasons: ["시장 핵심 지표가 부족해 후보 우선순위를 확정하지 않았습니다."],
      missingFacts: missing,
      estimatedUnitsBase: finiteOrNull(market.estimatedUnitsBase),
    };
  }

  const competitionOpportunity = 100 - market.competitionScore!;
  const entryOpportunity = 100 - market.entryDifficultyScore!;
  const riskScore = rounded(clamp(
    (100 - market.supplyScore!) * 0.35 +
      market.adBurdenScore! * 0.25 +
      market.entryDifficultyScore! * 0.25 +
      (100 - freshnessScore) * 0.15,
  ));
  const marketScore = rounded(clamp(
    market.opportunityScore! * 0.24 +
      market.demandScore! * 0.18 +
      market.growthScore! * 0.16 +
      competitionOpportunity * 0.14 +
      market.supplyScore! * 0.12 +
      entryOpportunity * 0.1 +
      (100 - riskScore) * 0.06,
  ));
  const confidenceAdjustedScore = rounded(clamp(
    marketScore * (confidence / 100) * scoreCoverage * (freshnessScore / 100),
  ));
  const economicallyEligible =
    input.profitabilityStatus === "CONFIRMED" &&
    input.contributionMarginRate !== null &&
    input.contributionMarginRate > 0 &&
    input.rightsStatus === "PASS";
  const readyForReview =
    economicallyEligible && confidence >= MIN_CONFIDENCE && scoreCoverage >= MIN_COVERAGE;
  const decision: ShadowDecision = readyForReview && confidenceAdjustedScore >= 65
    ? "PRIORITIZE_FOR_REVIEW"
    : confidenceAdjustedScore >= 45
      ? "WATCH"
      : "DO_NOT_PRIORITIZE";

  return {
    version: MARKET_INTELLIGENCE_SHADOW_VERSION,
    providerItemNumber: input.providerItemNumber,
    eligibility: "SHADOW_CANDIDATE",
    decision,
    marketScore,
    confidenceAdjustedScore,
    scoreCoverage,
    freshnessScore,
    riskScore,
    confidence,
    reasons: [
      market.demandScore! >= 65 ? "수요 신호가 강합니다." : "수요 신호가 아직 제한적입니다.",
      competitionOpportunity >= 55 ? "경쟁·진입 부담이 상대적으로 낮습니다." : "경쟁·진입 부담이 높습니다.",
      economicallyEligible ? "확정 수익성과 권리 통과를 확인했습니다." : "수익성 또는 권리 확인이 남아 있습니다.",
    ],
    missingFacts: missing,
    estimatedUnitsBase: finiteOrNull(market.estimatedUnitsBase),
  };
}
