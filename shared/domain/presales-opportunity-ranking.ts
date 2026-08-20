import {
  analyzeMarketOpportunity,
  type MarketOpportunityInput,
  type MarketOpportunityResult,
} from "./market-opportunity-analysis";

export const PRESALES_OPPORTUNITY_RANKING_VERSION =
  "gonggamline-presales-opportunity-ranking-v1" as const;

export type PresalesOpportunityCandidate = Readonly<MarketOpportunityInput & {
  rightsStatus: "PASS" | "UNKNOWN" | "FAIL";
  contactable: boolean;
}>;

export type PresalesOpportunityTier =
  | "PRIORITY_RESEARCH"
  | "VALIDATE_ECONOMICS"
  | "WATCH"
  | "BLOCKED";

export type PresalesOpportunityAssessment = Readonly<{
  version: typeof PRESALES_OPPORTUNITY_RANKING_VERSION;
  providerItemNumber: string;
  title: string;
  tier: PresalesOpportunityTier;
  pointScore: number | null;
  lowerBoundScore: number | null;
  upperBoundScore: number | null;
  confidence: number;
  evidenceCoverage: number;
  sourceDiversity: number;
  market: MarketOpportunityResult;
  missingFacts: readonly string[];
  rationale: readonly string[];
}>;

function clamp(value: number, minimum = 0, maximum = 100): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, digits = 2): number {
  const scale = 10 ** digits;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

function sourceDiversity(candidate: PresalesOpportunityCandidate): number {
  return new Set(candidate.observations.map((observation) => observation.sourceKind)).size;
}

function freshnessScore(candidate: PresalesOpportunityCandidate, now: Date): number {
  if (candidate.observations.length === 0) return 0;
  const ages = candidate.observations.map((observation) => {
    const timestamp = Date.parse(observation.observedAt);
    if (!Number.isFinite(timestamp)) return 0;
    return clamp(100 - Math.max(0, now.getTime() - timestamp) / 86_400_000 / 30 * 100);
  });
  return ages.reduce((sum, value) => sum + value, 0) / ages.length;
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter((value) => value.trim() !== ""))].sort();
}

/**
 * Ranks opportunities before sales data exists. Missing economics lower
 * confidence and create a validation tier; they do not erase useful market
 * candidates. This is research-only and never changes operational verdicts.
 */
export function assessPresalesOpportunity(
  candidate: PresalesOpportunityCandidate,
  now = new Date(),
): PresalesOpportunityAssessment {
  if (!/^\d{1,20}$/.test(candidate.providerItemNumber)) {
    throw new RangeError("providerItemNumber must contain 1 to 20 digits.");
  }
  const market = analyzeMarketOpportunity(candidate, now);
  const diversity = sourceDiversity(candidate);
  const freshness = freshnessScore(candidate, now);
  const pointScore = market.marketScore;
  const coverage = market.evidenceCoverage;
  const confidence = round(clamp(
    market.marketConfidence * 0.55 +
      Math.min(100, diversity / 3 * 100) * 0.2 +
      freshness * 0.15 +
      (candidate.contactable ? 10 : 0),
  ));
  const uncertainty = round((1 - coverage) * 20 + (diversity < 2 ? 8 : 0));
  const lowerBoundScore = pointScore === null ? null : round(clamp(pointScore - uncertainty));
  const upperBoundScore = pointScore === null ? null : round(clamp(pointScore + uncertainty));
  const missingFacts = uniqueSorted([
    ...market.missingFacts,
    ...(candidate.rightsStatus === "UNKNOWN" ? ["rights.publicationGrant"] : []),
    ...(candidate.contactable ? [] : ["supplier.contactability"]),
  ]);
  const rationale: string[] = [];
  if (candidate.rightsStatus === "FAIL") rationale.push("권리 실패는 자산·게시 경로를 차단합니다.");
  else if (candidate.rightsStatus === "UNKNOWN") rationale.push("권리는 미확정이지만 사실·키워드 연구 후보로 유지합니다.");
  if (pointScore !== null) rationale.push(`시장 기회 점수 ${pointScore}점, 불확실성 범위 ${lowerBoundScore}~${upperBoundScore}점입니다.`);
  else rationale.push("시장 관측치가 부족해 추가 수집이 우선입니다.");
  if (market.marginRate === null) rationale.push("판매 전 단위경제가 미완성이라 손익 확인을 다음 검증 단계로 분리합니다.");
  else if (market.marginRate >= 0.15) rationale.push(`사전 단위 기여마진율 ${(market.marginRate * 100).toFixed(1)}%가 계산되었습니다.`);
  if (diversity >= 2) rationale.push("서로 다른 출처가 있어 단일 출처 편향이 낮습니다.");
  if (!candidate.contactable) rationale.push("실제 컨택 가능성 확인 전에는 실행 후보가 아닙니다.");

  let tier: PresalesOpportunityTier;
  if (candidate.rightsStatus === "FAIL" || market.status === "NOT_ECONOMIC") tier = "BLOCKED";
  else if (pointScore !== null && pointScore >= 65 && coverage >= 0.5 && confidence >= 45) tier = "PRIORITY_RESEARCH";
  else if (pointScore !== null && pointScore >= 45) tier = "VALIDATE_ECONOMICS";
  else tier = "WATCH";

  return Object.freeze({
    version: PRESALES_OPPORTUNITY_RANKING_VERSION,
    providerItemNumber: candidate.providerItemNumber,
    title: candidate.title,
    tier,
    pointScore,
    lowerBoundScore,
    upperBoundScore,
    confidence,
    evidenceCoverage: coverage,
    sourceDiversity: diversity,
    market,
    missingFacts,
    rationale: Object.freeze(rationale),
  });
}

/** Selects a bounded, category-diverse research queue without writes. */
export function rankPresalesOpportunities(
  candidates: readonly PresalesOpportunityCandidate[],
  limit = 20,
  now = new Date(),
): PresalesOpportunityAssessment[] {
  if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 100) throw new RangeError("limit must be between 1 and 100.");
  const assessments = candidates.map((candidate) => assessPresalesOpportunity(candidate, now));
  const byId = new Map(candidates.map((candidate) => [candidate.providerItemNumber, candidate]));
  const ordered = [...assessments].sort((left, right) =>
    ({ PRIORITY_RESEARCH: 0, VALIDATE_ECONOMICS: 1, WATCH: 2, BLOCKED: 3 }[left.tier] -
      { PRIORITY_RESEARCH: 0, VALIDATE_ECONOMICS: 1, WATCH: 2, BLOCKED: 3 }[right.tier]) ||
    (right.lowerBoundScore ?? -1) - (left.lowerBoundScore ?? -1) ||
    right.confidence - left.confidence ||
    left.providerItemNumber.localeCompare(right.providerItemNumber, "en", { numeric: true }),
  );
  const selected: PresalesOpportunityAssessment[] = [];
  const categoryCounts = new Map<string, number>();
  for (const assessment of ordered) {
    if (selected.length >= limit) break;
    const category = byId.get(assessment.providerItemNumber)?.category?.trim().toLocaleLowerCase() ?? "unknown";
    const count = categoryCounts.get(category) ?? 0;
    if (count >= 3 && ordered.some((item) => !selected.includes(item) && byId.get(item.providerItemNumber)?.category?.trim().toLocaleLowerCase() !== category)) continue;
    selected.push(assessment);
    categoryCounts.set(category, count + 1);
  }
  return selected;
}
