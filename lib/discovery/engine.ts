export type DiscoveryMetric = {
  opportunity_score?: number | null;
  demand_score?: number | null;
  growth_score?: number | null;
  competition_score?: number | null;
  stability_score?: number | null;
  supply_score?: number | null;
  entry_difficulty_score?: number | null;
  ad_burden_score?: number | null;
  confidence?: number | null;
  estimated_units_low?: number | null;
  estimated_units_high?: number | null;
  recommendation_reason?: string | null;
};

export type DiscoveryProduct = {
  id: number;
  title: string;
  category?: string | null;
  brand?: string | null;
  seller_name?: string | null;
  metric: DiscoveryMetric;
};

export type DecisionAction = "approve" | "review" | "hold" | "reject";

const n = (value: number | null | undefined, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value * 100) / 100));

function decide(score: number, confidence: number, risk: number): DecisionAction {
  if (score >= 78 && confidence >= 60 && risk <= 50) return "approve";
  if (score >= 62 && confidence >= 40 && risk <= 68) return "review";
  if (score >= 48 && risk <= 82) return "hold";
  return "reject";
}

export function scoreSingle(product: DiscoveryProduct) {
  const m = product.metric;
  const marketScore = clamp(n(m.opportunity_score, n(m.demand_score, 0)));
  const growthScore = clamp(n(m.growth_score, 0));
  const competitionScore = clamp(n(m.competition_score, 50));
  const supplyScore = clamp(n(m.supply_score, 50));
  const stabilityScore = clamp(n(m.stability_score, 50));
  const seasonScore = clamp(stabilityScore * .7 + marketScore * .3);
  const riskScore = clamp((100 - stabilityScore) * .30 + (100 - supplyScore) * .28 + n(m.entry_difficulty_score, 50) * .22 + n(m.ad_burden_score, 50) * .20);
  const marginScore = clamp(stabilityScore * .25 + supplyScore * .30 + (100 - n(m.entry_difficulty_score, 50)) * .30 + (100 - n(m.ad_burden_score, 50)) * .15);
  const confidence = Math.round(clamp(n(m.confidence, 0)));
  const decisionScore = clamp(
    marketScore * .24 + growthScore * .17 + (100 - competitionScore) * .13 +
    supplyScore * .13 + marginScore * .15 + seasonScore * .06 +
    (100 - riskScore) * .12
  );
  const decision = decide(decisionScore, confidence, riskScore);
  const positives = [
    marketScore >= 70 ? "시장 기회가 큼" : null,
    growthScore >= 65 ? "성장 신호가 강함" : null,
    competitionScore <= 45 ? "경쟁 부담이 낮음" : null,
    marginScore >= 65 ? "마진 가능성이 양호함" : null,
    supplyScore >= 70 ? "공급 안정성이 높음" : null,
  ].filter(Boolean) as string[];
  const risks = [
    riskScore >= 65 ? "운영 위험이 높음" : null,
    competitionScore >= 75 ? "경쟁이 과열됨" : null,
    confidence < 45 ? "데이터 신뢰도가 낮음" : null,
    supplyScore < 40 ? "공급 안정성이 낮음" : null,
  ].filter(Boolean) as string[];
  const reasons = [m.recommendation_reason, ...positives].filter(Boolean);
  const explanation = reasons.join(" · ") || "시장 데이터 축적이 더 필요합니다.";
  const riskExplanation = risks.join(" · ") || "현재 데이터에서 중대한 위험 신호는 제한적입니다.";

  return {
    aiScore: decisionScore,
    decisionScore,
    decision,
    marketScore,
    growthScore,
    competitionScore,
    supplyScore,
    seasonScore,
    riskScore,
    marginScore,
    profitScore: marginScore,
    confidence,
    estimatedUnitsLow: Math.round(n(m.estimated_units_low, 0)),
    estimatedUnitsHigh: Math.round(n(m.estimated_units_high, 0)),
    reason: explanation,
    riskExplanation,
    evidence: {
      title: product.title,
      category: product.category,
      metric: m,
      positiveSignals: positives,
      riskSignals: risks,
      weights: { market: .24, growth: .17, competition: .13, supply: .13, margin: .15, season: .06, risk: .12 },
    },
  };
}

const tokens = (text: string) => new Set(text.toLowerCase().replace(/[^0-9a-z가-힣 ]/g, " ").split(/\s+/).filter((x) => x.length >= 2));
function overlap(a: string, b: string) { const aa=tokens(a), bb=tokens(b); if(!aa.size||!bb.size) return 0; return [...aa].filter((x)=>bb.has(x)).length/Math.max(aa.size,bb.size); }

export function scoreBundle(anchor: DiscoveryProduct, complement: DiscoveryProduct) {
  const a = scoreSingle(anchor), b = scoreSingle(complement);
  const sameCategory = Boolean(anchor.category && complement.category && anchor.category === complement.category);
  const textOverlap = overlap(anchor.title, complement.title);
  const synergyScore = clamp(45 + (sameCategory ? 25 : 0) + textOverlap * 25 + Math.min(a.growthScore, b.growthScore) * .05);
  const convenienceScore = clamp(55 + (sameCategory ? 15 : 0) + (100 - Math.abs(a.marketScore - b.marketScore)) * .15);
  const differentiationScore = clamp(60 + (100 - Math.max(a.competitionScore, b.competitionScore)) * .2 + (100 - textOverlap * 100) * .1);
  const marginScore = clamp((a.marginScore + b.marginScore) / 2);
  const riskScore = clamp((a.riskScore + b.riskScore) / 2 + (sameCategory ? 0 : 8));
  const decisionScore = clamp(synergyScore * .29 + convenienceScore * .18 + differentiationScore * .18 + marginScore * .22 + (100-riskScore) * .13);
  const confidence = Math.round(Math.min(a.confidence, b.confidence) * .8 + Math.max(a.confidence, b.confidence) * .2);
  return {
    aiScore: decisionScore,
    decisionScore,
    decision: decide(decisionScore, confidence, riskScore),
    synergyScore,
    convenienceScore,
    differentiationScore,
    marginScore,
    riskScore,
    confidence,
    reason: `${anchor.title}을(를) 중심으로 ${complement.title}을(를) 결합하면 구매 편의성과 차별화를 높일 가능성이 있습니다.`,
  };
}
