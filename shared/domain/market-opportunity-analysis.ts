import type { MarketDiscoverySourceKind } from "./market-discovery-evidence";

export const MARKET_OPPORTUNITY_ANALYSIS_VERSION =
  "gonggamline-market-opportunity-analysis-v1" as const;

export type MarketEvidenceObservation = Readonly<{
  sourceKind: MarketDiscoverySourceKind;
  observedAt: string;
  demandScore: number | null;
  growthScore: number | null;
  competitionScore: number | null;
  supplyScore: number | null;
  contentVelocityScore: number | null;
  reviewVelocityScore: number | null;
  price: number | null;
  confidence: number | null;
}>;

export type CandidateUnitEconomics = Readonly<{
  salePrice: number | null;
  productCost: number | null;
  inboundCost: number | null;
  fulfillmentCost: number | null;
  marketplaceFee: number | null;
  returnAllowance: number | null;
}>;

export type MarketOpportunityInput = Readonly<{
  providerItemNumber: string;
  title: string;
  category: string | null;
  observations: readonly MarketEvidenceObservation[];
  economics: CandidateUnitEconomics;
  complementTags: readonly string[];
}>;

export type MarketOpportunityResult = Readonly<{
  version: typeof MARKET_OPPORTUNITY_ANALYSIS_VERSION;
  providerItemNumber: string;
  title: string;
  marketScore: number | null;
  marketConfidence: number;
  marginRate: number | null;
  evidenceCoverage: number;
  status: "ACTIONABLE" | "COST_CONFIRMATION_REQUIRED" | "INSUFFICIENT_MARKET_EVIDENCE" | "NOT_ECONOMIC";
  reasons: readonly string[];
  missingFacts: readonly string[];
}>;

export type ProductConfiguration = Readonly<{
  type: "SINGLE" | "SET" | "BUNDLE";
  componentItemNumbers: readonly string[];
  title: string;
  marketScore: number | null;
  marginRate: number | null;
  status: "ACTIONABLE" | "COST_CONFIRMATION_REQUIRED" | "INSUFFICIENT_MARKET_EVIDENCE" | "NOT_ECONOMIC";
  rationale: readonly string[];
}>;

const SOURCE_WEIGHT: Record<MarketDiscoverySourceKind, number> = {
  official_api: 1,
  paid_api: 0.98,
  public_dataset: 0.95,
  manual: 0.85,
  public_page: 0.75,
  short_video_public: 0.65,
};

function bounded(value: number | null): number | null {
  return value === null || !Number.isFinite(value) ? null : Math.min(100, Math.max(0, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function freshness(observedAt: string, now: Date): number {
  const timestamp = Date.parse(observedAt);
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(0, Math.min(100, 100 - Math.max(0, now.getTime() - timestamp) / 86_400_000 / 30 * 100));
}

function average(values: readonly number[]): number | null {
  return values.length === 0 ? null : round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function marginRate(economics: CandidateUnitEconomics): number | null {
  const values = [economics.salePrice, economics.productCost, economics.inboundCost, economics.fulfillmentCost, economics.marketplaceFee, economics.returnAllowance];
  if (values.some((value) => value === null || !Number.isFinite(value))) return null;
  if (economics.salePrice! <= 0) return null;
  const costs = economics.productCost! + economics.inboundCost! + economics.fulfillmentCost! + economics.marketplaceFee! + economics.returnAllowance!;
  return round((economics.salePrice! - costs) / economics.salePrice!);
}

export function analyzeMarketOpportunity(
  input: MarketOpportunityInput,
  now = new Date(),
): MarketOpportunityResult {
  if (!/^\d{1,20}$/.test(input.providerItemNumber)) throw new RangeError("providerItemNumber must contain 1 to 20 digits.");
  if (!input.title.trim()) throw new RangeError("title is required.");
  const values = input.observations.map((observation) => {
    const scores = [observation.demandScore, observation.growthScore, observation.competitionScore === null ? null : 100 - observation.competitionScore, observation.supplyScore, observation.contentVelocityScore, observation.reviewVelocityScore].map(bounded).filter((value): value is number => value !== null);
    const completeness = scores.length / 6;
    const freshnessScore = freshness(observation.observedAt, now);
    const confidence = bounded(observation.confidence) ?? 0;
    return { score: average(scores), weight: SOURCE_WEIGHT[observation.sourceKind] * (0.5 + confidence / 200) * freshnessScore / 100, completeness };
  });
  const weighted = values.filter((value): value is { score: number; weight: number; completeness: number } => value.score !== null && value.weight > 0);
  const totalWeight = weighted.reduce((sum, value) => sum + value.weight, 0);
  const marketScore = totalWeight === 0 ? null : round(weighted.reduce((sum, value) => sum + value.score * value.weight, 0) / totalWeight);
  const evidenceCoverage = values.length === 0 ? 0 : round(values.reduce((sum, value) => sum + value.completeness, 0) / values.length);
  const marketConfidence = round(Math.min(100, evidenceCoverage * 60 + Math.min(1, values.length / 3) * 40));
  const contributionMarginRate = marginRate(input.economics);
  const missingFacts: string[] = [];
  if (marketScore === null) missingFacts.push("market.observations");
  if (evidenceCoverage < 0.67) missingFacts.push("market.evidenceCoverage");
  if (contributionMarginRate === null) missingFacts.push("profitability.unitEconomics");
  const reasons = [
    marketScore !== null ? `복수 출처 시장점수 ${marketScore}점` : "시장점수를 계산할 관측치가 부족합니다.",
    `시장 증거 커버리지 ${(evidenceCoverage * 100).toFixed(0)}%`,
    contributionMarginRate !== null ? `단위 기여마진율 ${(contributionMarginRate * 100).toFixed(1)}%` : "단위경제 입력이 완전하지 않습니다.",
  ];
  let status: MarketOpportunityResult["status"] = "INSUFFICIENT_MARKET_EVIDENCE";
  if (marketScore !== null && marketScore >= 55 && contributionMarginRate !== null && contributionMarginRate >= 0.15) status = "ACTIONABLE";
  else if (marketScore !== null && marketScore >= 50 && contributionMarginRate === null) status = "COST_CONFIRMATION_REQUIRED";
  else if (contributionMarginRate !== null && contributionMarginRate < 0) status = "NOT_ECONOMIC";
  return Object.freeze({ version: MARKET_OPPORTUNITY_ANALYSIS_VERSION, providerItemNumber: input.providerItemNumber, title: input.title, marketScore, marketConfidence, marginRate: contributionMarginRate, evidenceCoverage, status, reasons: Object.freeze(reasons), missingFacts: Object.freeze([...new Set(missingFacts)].sort()) });
}

/** Suggests single, set, and bundle configurations without writing or buying. */
export function proposeProductConfigurations(
  inputs: readonly MarketOpportunityInput[],
  now = new Date(),
): ProductConfiguration[] {
  const analyses = inputs.map((input) => analyzeMarketOpportunity(input, now));
  const byId = new Map(inputs.map((input, index) => [input.providerItemNumber, { input, analysis: analyses[index] }]));
  const results: ProductConfiguration[] = analyses.map((analysis) => ({ type: "SINGLE", componentItemNumbers: [analysis.providerItemNumber], title: analysis.title, marketScore: analysis.marketScore, marginRate: analysis.marginRate, status: analysis.status, rationale: analysis.reasons }));
  for (let index = 0; index < inputs.length; index += 1) {
    for (let other = index + 1; other < inputs.length; other += 1) {
      const left = inputs[index];
      const right = inputs[other];
      if (!left.complementTags.some((tag) => right.complementTags.includes(tag))) continue;
      const leftAnalysis = byId.get(left.providerItemNumber)!.analysis;
      const rightAnalysis = byId.get(right.providerItemNumber)!.analysis;
      const marketScore = leftAnalysis.marketScore === null || rightAnalysis.marketScore === null ? null : round((leftAnalysis.marketScore + rightAnalysis.marketScore) / 2);
      const marginRateValue = marginRate({ salePrice: null, productCost: null, inboundCost: null, fulfillmentCost: null, marketplaceFee: null, returnAllowance: null });
      results.push({ type: "SET", componentItemNumbers: [left.providerItemNumber, right.providerItemNumber], title: `${left.title} + ${right.title} 세트`, marketScore, marginRate: marginRateValue, status: marketScore !== null && marketScore >= 55 ? "COST_CONFIRMATION_REQUIRED" : "INSUFFICIENT_MARKET_EVIDENCE", rationale: ["상호 보완 태그가 확인된 구성입니다.", "세트 단위 가격·포장·물류비를 별도 확인해야 합니다."] });
    }
  }
  return results.sort((left, right) => (right.marketScore ?? -1) - (left.marketScore ?? -1) || left.type.localeCompare(right.type) || left.componentItemNumbers.join(",").localeCompare(right.componentItemNumbers.join(",")));
}
