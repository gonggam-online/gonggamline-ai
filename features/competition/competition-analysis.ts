export type CompetitionInput = {
  marketPrice: number;
  top10AveragePrice: number;
  resultCount: number;
  rocketRatio: number;
  averageReviewCount: number;
  averageRating: number;
  monthlySearchVolume: number;
  salePrice: number;
  estimatedProfit: number;
  marginRate: number;
};

export type CompetitionAnalysis = {
  competitionScore: number;
  marketabilityScore: number;
  priceCompetitivenessScore: number;
  reviewEntryScore: number;
  rocketCompetitionScore: number;
  keywordDemandScore: number;
  grade: "S" | "A" | "B" | "C" | "D";
  estimatedMonthlyUnitsLow: number;
  estimatedMonthlyUnitsHigh: number;
  estimatedMonthlySalesLow: number;
  estimatedMonthlySalesHigh: number;
  summary: string;
};

const clamp = (value: number, minimum = 0, maximum = 100) =>
  Math.min(maximum, Math.max(minimum, value));
const round1 = (value: number) => Math.round(value * 10) / 10;

export function analyzeCompetition(input: CompetitionInput): CompetitionAnalysis {
  const demand = clamp(20 + Math.log10(Math.max(1, input.monthlySearchVolume)) * 18);
  const saturationPenalty = clamp(Math.log10(Math.max(1, input.resultCount)) * 18);
  const marketability = clamp(demand * 0.75 + (100 - saturationPenalty) * 0.25);

  const referencePrice = input.top10AveragePrice || input.marketPrice || input.salePrice;
  const priceRatio = referencePrice > 0 ? input.salePrice / referencePrice : 1;
  const priceScore = clamp(100 - Math.max(0, priceRatio - 0.82) * 170 - Math.max(0, 0.65 - priceRatio) * 80);

  const reviewBarrier = clamp(Math.log10(Math.max(1, input.averageReviewCount + 1)) * 28);
  const reviewEntry = clamp(100 - reviewBarrier + (input.averageRating < 4.3 ? 8 : 0));
  const rocketScore = clamp(100 - input.rocketRatio);

  const profitScore = clamp(input.marginRate * 2 + Math.min(30, input.estimatedProfit / 250));
  const total = round1(
    marketability * 0.25 +
      priceScore * 0.22 +
      reviewEntry * 0.18 +
      rocketScore * 0.15 +
      demand * 0.1 +
      profitScore * 0.1
  );

  const grade: CompetitionAnalysis["grade"] =
    total >= 85 ? "S" : total >= 75 ? "A" : total >= 65 ? "B" : total >= 50 ? "C" : "D";

  const conversionBase = clamp((total - 35) / 100, 0.02, 0.55);
  const unitsLow = Math.max(1, Math.round((input.monthlySearchVolume * conversionBase) / 100));
  const unitsHigh = Math.max(unitsLow, Math.round(unitsLow * 2.1));

  const strengths: string[] = [];
  const risks: string[] = [];
  if (priceScore >= 75) strengths.push("가격 진입력이 좋음"); else risks.push("판매가 경쟁력 보완 필요");
  if (reviewEntry >= 70) strengths.push("리뷰 장벽이 낮음"); else risks.push("상위 상품 리뷰 장벽이 높음");
  if (rocketScore >= 65) strengths.push("로켓 경쟁이 상대적으로 낮음"); else risks.push("로켓 상품 비중이 높음");
  if (input.marginRate >= 25) strengths.push("마진 구조가 양호함"); else risks.push("광고비 반영 시 마진 부족 가능");

  return {
    competitionScore: total,
    marketabilityScore: round1(marketability),
    priceCompetitivenessScore: round1(priceScore),
    reviewEntryScore: round1(reviewEntry),
    rocketCompetitionScore: round1(rocketScore),
    keywordDemandScore: round1(demand),
    grade,
    estimatedMonthlyUnitsLow: unitsLow,
    estimatedMonthlyUnitsHigh: unitsHigh,
    estimatedMonthlySalesLow: Math.round(unitsLow * input.salePrice),
    estimatedMonthlySalesHigh: Math.round(unitsHigh * input.salePrice),
    summary: `${strengths.join(", ") || "뚜렷한 강점 데이터 부족"}. ${risks.join(", ") || "중대한 위험 신호 없음"}.`,
  };
}
