import {
  calculateProductRevenue,
  type RevenueCalculationResult,
} from "./calculation.ts";

export const REVENUE_SCORE_WEIGHTS = {
  profit: 0.3,
  margin: 0.2,
  searchDemand: 0.2,
  competition: 0.15,
  supplyStability: 0.1,
  dataQuality: 0.05,
} as const;

export const REVENUE_SCORE_NORMALIZATION = {
  profitAtMaximum: 1_000_000,
  marginAtMaximum: 40,
  searchDemandAtMaximum: 100_000,
} as const;

export type RevenueScoreFactor =
  | "profit"
  | "margin"
  | "searchDemand"
  | "competition"
  | "supplyStability"
  | "dataQuality";

export type RevenueScoreStatus =
  | "ready"
  | "estimated"
  | "incomplete"
  | "invalid";

export type RevenueScoreInput = {
  revenueCalculation: RevenueCalculationResult;
  monthlySearchVolume?: unknown;
  competitionScore?: unknown;
  competitionStatus?: unknown;
  competitionSource?: unknown;
  competitionConfidence?: unknown;
  supplyStabilityScore?: unknown;
};

export type RevenueScoreBreakdownItem = {
  score: number | null;
  configuredWeight: number;
  appliedWeight: number;
};

export type RevenueScoreResult = {
  status: RevenueScoreStatus;
  revenueScore: number | null;
  scoreBreakdown: Record<RevenueScoreFactor, RevenueScoreBreakdownItem>;
  confidence: number;
  missingFactors: RevenueScoreFactor[];
  assumptions: string[];
};

const REQUIRED_FACTORS: Exclude<
  RevenueScoreFactor,
  "supplyStability" | "dataQuality"
>[] = [
  "profit",
  "margin",
  "searchDemand",
  "competition",
];

function clamp(value: number, minimum = 0, maximum = 100): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function roundScore(value: number): number {
  return Math.round(clamp(value) * 10) / 10;
}

function roundConfidence(value: number): number {
  return Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function normalizeProfit(monthlyProfit: number): number {
  return roundScore(
    (monthlyProfit / REVENUE_SCORE_NORMALIZATION.profitAtMaximum) * 100,
  );
}

export function normalizeMargin(marginRate: number): number {
  return roundScore(
    (marginRate / REVENUE_SCORE_NORMALIZATION.marginAtMaximum) * 100,
  );
}

export function normalizeSearchDemand(monthlySearchVolume: number): number {
  if (monthlySearchVolume <= 0) return 0;
  return roundScore(
    (
      Math.log10(monthlySearchVolume + 1)
      / Math.log10(REVENUE_SCORE_NORMALIZATION.searchDemandAtMaximum + 1)
    ) * 100,
  );
}

export function normalizeCompetition(competitionScore: number): number {
  return roundScore(100 - competitionScore);
}

function normalizedOptionalScore(value: unknown): number | null {
  const parsed = finiteNumber(value);
  if (parsed === null || parsed < 0 || parsed > 100) return null;
  return roundScore(parsed);
}

function dataQualityScore(
  availableRequiredFactors: number,
  calculation: RevenueCalculationResult,
  competitionStatus: unknown,
  competitionSource: unknown,
): number {
  let score = (availableRequiredFactors / REQUIRED_FACTORS.length) * 100;
  if (calculation.status === "estimated") score -= 15;
  if (competitionStatus === "estimated" || competitionSource === "estimated") {
    score -= 10;
  }
  return roundScore(score);
}

function statusFor(
  calculation: RevenueCalculationResult,
  missingRequiredCount: number,
  usesEstimate: boolean,
): RevenueScoreStatus {
  if (calculation.status === "invalid") return "invalid";
  if (calculation.status === "incomplete" || missingRequiredCount > 0) {
    return "incomplete";
  }
  return usesEstimate ? "estimated" : "ready";
}

export function calculateRevenueScore(
  input: RevenueScoreInput,
): RevenueScoreResult {
  const { revenueCalculation } = input;
  const assumptions = [
    "Profit and margin reuse the Revenue Calculation result without recalculation.",
    "Profit reaches 100 at KRW 1,000,000 estimated monthly contribution profit.",
    "Margin reaches 100 at a 40% contribution margin.",
    "Search demand uses logarithmic scaling and reaches 100 at 100,000 monthly searches.",
    "Competition is inverted so lower competition produces a higher score.",
  ];

  const profit = revenueCalculation.estimatedProfitBase === null
    ? null
    : normalizeProfit(revenueCalculation.estimatedProfitBase);
  const margin = revenueCalculation.contributionMarginRate === null
    ? null
    : normalizeMargin(revenueCalculation.contributionMarginRate);
  const searchVolume = finiteNumber(input.monthlySearchVolume);
  const searchDemand =
    searchVolume === null || searchVolume < 0
      ? null
      : normalizeSearchDemand(searchVolume);
  const rawCompetition = finiteNumber(input.competitionScore);
  const competition =
    rawCompetition === null || rawCompetition < 0 || rawCompetition > 100
      ? null
      : normalizeCompetition(rawCompetition);
  const supplyStability = normalizedOptionalScore(input.supplyStabilityScore);

  const preliminary = {
    profit,
    margin,
    searchDemand,
    competition,
    supplyStability,
  };
  const missingFactors = (Object.entries(preliminary) as [
    Exclude<RevenueScoreFactor, "dataQuality">,
    number | null,
  ][])
    .filter(([, score]) => score === null)
    .map(([factor]) => factor);
  const availableRequiredFactors = REQUIRED_FACTORS.filter(
    (factor) => preliminary[factor] !== null,
  ).length;
  const dataQuality = dataQualityScore(
    availableRequiredFactors,
    revenueCalculation,
    input.competitionStatus,
    input.competitionSource,
  );
  const scores: Record<RevenueScoreFactor, number | null> = {
    ...preliminary,
    dataQuality,
  };
  const availableWeight = (
    Object.entries(scores) as [RevenueScoreFactor, number | null][]
  ).reduce(
    (total, [factor, score]) =>
      total + (score === null ? 0 : REVENUE_SCORE_WEIGHTS[factor]),
    0,
  );
  const scoreBreakdown = Object.fromEntries(
    (Object.entries(scores) as [RevenueScoreFactor, number | null][]).map(
      ([factor, score]) => [
        factor,
        {
          score,
          configuredWeight: REVENUE_SCORE_WEIGHTS[factor],
          appliedWeight:
            score === null || availableWeight === 0
              ? 0
              : Math.round(
                (REVENUE_SCORE_WEIGHTS[factor] / availableWeight) * 10000,
              ) / 10000,
        },
      ],
    ),
  ) as Record<RevenueScoreFactor, RevenueScoreBreakdownItem>;
  const revenueScore =
    revenueCalculation.status === "invalid" || availableRequiredFactors === 0
    ? null
    : roundScore(
      (Object.entries(scoreBreakdown) as [
        RevenueScoreFactor,
        RevenueScoreBreakdownItem,
      ][]).reduce(
        (total, [factor, breakdown]) =>
          total + (scores[factor] ?? 0) * breakdown.appliedWeight,
        0,
      ),
    );

  const missingRequiredCount =
    REQUIRED_FACTORS.length - availableRequiredFactors;
  const usesRevenueEstimate = revenueCalculation.status === "estimated";
  const usesCompetitionEstimate =
    input.competitionStatus === "estimated"
    || input.competitionSource === "estimated";
  let confidence =
    revenueCalculation.status === "invalid" ? 0 : dataQuality / 100;
  if (usesRevenueEstimate) confidence -= 0.1;
  if (usesCompetitionEstimate) confidence -= 0.1;
  const reportedCompetitionConfidence = normalizedOptionalScore(
    input.competitionConfidence,
  );
  if (reportedCompetitionConfidence !== null && competition !== null) {
    confidence *= reportedCompetitionConfidence / 100;
    assumptions.push(
      "Confidence includes the stored competition confidence percentage.",
    );
  }
  if (supplyStability === null) {
    assumptions.push(
      "Supply stability is unavailable and its weight is excluded.",
    );
  }
  if (usesRevenueEstimate) {
    assumptions.push("Revenue Calculation uses estimated base sales.");
  }
  if (usesCompetitionEstimate) {
    assumptions.push("Competition data is estimated.");
  }

  return {
    status: statusFor(
      revenueCalculation,
      missingRequiredCount,
      usesRevenueEstimate || usesCompetitionEstimate,
    ),
    revenueScore,
    scoreBreakdown,
    confidence: roundConfidence(confidence),
    missingFactors,
    assumptions,
  };
}

function productField(
  product: Record<string, unknown>,
  name: string,
): unknown {
  return Object.prototype.hasOwnProperty.call(product, name)
    ? product[name]
    : undefined;
}

export function calculateProductRevenueScore(
  product: Record<string, unknown>,
): RevenueScoreResult {
  return calculateRevenueScore({
    revenueCalculation: calculateProductRevenue(product),
    monthlySearchVolume: productField(
      product,
      "coupang_keyword_search_volume",
    ),
    competitionScore: productField(product, "competition_score"),
    competitionStatus: productField(product, "competition_analysis_status"),
    competitionSource: productField(product, "competition_data_source"),
    competitionConfidence: productField(product, "competition_confidence"),
  });
}

export function attachRevenueScores(
  products: Record<string, unknown>[],
): Record<string, unknown>[] {
  return products.map((product) => ({
    ...product,
    revenueScore: calculateProductRevenueScore(product),
  }));
}
