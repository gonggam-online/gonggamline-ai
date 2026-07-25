import {
  calculateProductRevenue,
  type RevenueCalculationResult,
} from "./calculation.ts";
import {
  calculateRevenueScore,
  type RevenueScoreFactor,
  type RevenueScoreResult,
  type RevenueScoreStatus,
} from "./score.ts";

export const REVENUE_RANKING_WEIGHTS = {
  revenueScore: 0.6,
  competition: 0.1,
  confidence: 0.1,
  freshness: 0.075,
  dataCompleteness: 0.075,
  dataQuality: 0.05,
} as const;

export type RevenueRecommendationLevel =
  | "STRONG_RECOMMEND"
  | "RECOMMEND"
  | "WATCH"
  | "NOT_RECOMMENDED";

export type RevenueRankingReasonCode =
  | "HIGH_MARGIN"
  | "HIGH_DEMAND"
  | "LOW_COMPETITION"
  | "LOW_CONFIDENCE"
  | "STALE_DATA"
  | "MISSING_COST";

export type RevenueRankingFactors = {
  competition: number | null;
  confidence: number;
  freshness: number | null;
  dataCompleteness: number;
  dataQuality: number;
};

export type RevenueRankingResult = {
  rank: number;
  productId: string | null;
  productName: string | null;
  rankingScore: number;
  revenueScore: number | null;
  confidence: number;
  reasonCodes: RevenueRankingReasonCode[];
  status: RevenueScoreStatus;
  recommendationLevel: RevenueRecommendationLevel;
  rankingFactors: RevenueRankingFactors;
};

type RankedCandidate = RevenueRankingResult & {
  originalIndex: number;
};

const REQUIRED_SCORE_FACTORS: RevenueScoreFactor[] = [
  "profit",
  "margin",
  "searchDemand",
  "competition",
];

function field(product: Record<string, unknown>, name: string): unknown {
  return Object.prototype.hasOwnProperty.call(product, name)
    ? product[name]
    : undefined;
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

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== ""
    ? value
    : null;
}

function roundScore(value: number): number {
  return Math.round(Math.min(100, Math.max(0, value)) * 10) / 10;
}

function lowCompetitionScore(value: unknown): number | null {
  const competition = finiteNumber(value);
  if (competition === null || competition < 0 || competition > 100) {
    return null;
  }
  return roundScore(100 - competition);
}

export function calculateFreshnessScore(
  analyzedAt: unknown,
  now: Date,
): number | null {
  if (typeof analyzedAt !== "string" || analyzedAt.trim() === "") return null;
  const timestamp = Date.parse(analyzedAt);
  if (!Number.isFinite(timestamp)) return null;
  const ageDays = Math.max(0, (now.getTime() - timestamp) / 86_400_000);
  if (ageDays <= 7) return 100;
  if (ageDays <= 30) return 70;
  if (ageDays <= 90) return 40;
  return 0;
}

function completeness(score: RevenueScoreResult): number {
  const available = REQUIRED_SCORE_FACTORS.filter(
    (factor) => score.scoreBreakdown[factor].score !== null,
  ).length;
  return roundScore((available / REQUIRED_SCORE_FACTORS.length) * 100);
}

function rankingScore(
  revenueScore: RevenueScoreResult,
  factors: RevenueRankingFactors,
): number {
  return roundScore(
    (revenueScore.revenueScore ?? 0) * REVENUE_RANKING_WEIGHTS.revenueScore
      + (factors.competition ?? 0) * REVENUE_RANKING_WEIGHTS.competition
      + factors.confidence * 100 * REVENUE_RANKING_WEIGHTS.confidence
      + (factors.freshness ?? 0) * REVENUE_RANKING_WEIGHTS.freshness
      + factors.dataCompleteness
        * REVENUE_RANKING_WEIGHTS.dataCompleteness
      + factors.dataQuality * REVENUE_RANKING_WEIGHTS.dataQuality,
  );
}

function reasonCodes(
  calculation: RevenueCalculationResult,
  score: RevenueScoreResult,
  rawCompetition: unknown,
  freshness: number | null,
): RevenueRankingReasonCode[] {
  const reasons: RevenueRankingReasonCode[] = [];
  if ((score.scoreBreakdown.margin.score ?? -1) >= 75) {
    reasons.push("HIGH_MARGIN");
  }
  if ((score.scoreBreakdown.searchDemand.score ?? -1) >= 75) {
    reasons.push("HIGH_DEMAND");
  }
  const competition = finiteNumber(rawCompetition);
  if (competition !== null && competition >= 0 && competition <= 30) {
    reasons.push("LOW_COMPETITION");
  }
  if (score.confidence < 0.5) reasons.push("LOW_CONFIDENCE");
  if (freshness === 0) reasons.push("STALE_DATA");
  if (calculation.missingFields.includes("unitProductCost")) {
    reasons.push("MISSING_COST");
  }
  return reasons;
}

function recommendationLevel(
  status: RevenueScoreStatus,
  score: number,
  confidence: number,
): RevenueRecommendationLevel {
  if (status === "invalid" || status === "incomplete") {
    return "NOT_RECOMMENDED";
  }
  if (score >= 80 && confidence >= 0.75) return "STRONG_RECOMMEND";
  if (score >= 65 && confidence >= 0.5) return "RECOMMEND";
  if (score >= 40) return "WATCH";
  return "NOT_RECOMMENDED";
}

function statusPriority(status: RevenueScoreStatus): number {
  if (status === "ready") return 3;
  if (status === "estimated") return 2;
  if (status === "incomplete") return 1;
  return 0;
}

function scoreProduct(
  product: Record<string, unknown>,
  originalIndex: number,
  now: Date,
): RankedCandidate {
  const calculation = calculateProductRevenue(product);
  const rawCompetition = field(product, "competition_score");
  const score = calculateRevenueScore({
    revenueCalculation: calculation,
    monthlySearchVolume: field(product, "coupang_keyword_search_volume"),
    competitionScore: rawCompetition,
    competitionStatus: field(product, "competition_analysis_status"),
    competitionSource: field(product, "competition_data_source"),
    competitionConfidence: field(product, "competition_confidence"),
  });
  const freshness = calculateFreshnessScore(
    field(product, "competition_analyzed_at"),
    now,
  );
  const factors: RevenueRankingFactors = {
    competition: lowCompetitionScore(rawCompetition),
    confidence: score.confidence,
    freshness,
    dataCompleteness: completeness(score),
    dataQuality: score.scoreBreakdown.dataQuality.score ?? 0,
  };
  const finalScore = rankingScore(score, factors);

  return {
    rank: 0,
    productId: text(field(product, "product_no"))
      ?? text(field(product, "id")),
    productName: text(field(product, "title"))
      ?? text(field(product, "name")),
    rankingScore: finalScore,
    revenueScore: score.revenueScore,
    confidence: score.confidence,
    reasonCodes: reasonCodes(
      calculation,
      score,
      rawCompetition,
      freshness,
    ),
    status: score.status,
    recommendationLevel: recommendationLevel(
      score.status,
      finalScore,
      score.confidence,
    ),
    rankingFactors: factors,
    originalIndex,
  };
}

export function rankProductsByRevenue(
  products: readonly Record<string, unknown>[],
  options: { now?: Date } = {},
): RevenueRankingResult[] {
  const now = options.now ?? new Date();
  return products
    .map((product, index) => scoreProduct(product, index, now))
    .sort((left, right) => {
      const statusDifference =
        statusPriority(right.status) - statusPriority(left.status);
      if (statusDifference !== 0) return statusDifference;
      if (right.rankingScore !== left.rankingScore) {
        return right.rankingScore - left.rankingScore;
      }
      if ((right.revenueScore ?? -1) !== (left.revenueScore ?? -1)) {
        return (right.revenueScore ?? -1) - (left.revenueScore ?? -1);
      }
      if (right.confidence !== left.confidence) {
        return right.confidence - left.confidence;
      }
      const idDifference = (left.productId ?? "").localeCompare(
        right.productId ?? "",
      );
      return idDifference || left.originalIndex - right.originalIndex;
    })
    .map(({ originalIndex, ...result }, index) => {
      void originalIndex;
      return { ...result, rank: index + 1 };
    });
}
