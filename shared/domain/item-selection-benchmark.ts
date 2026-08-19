import type { ItemSelectionVerdict } from "./item-selection";

export const ITEM_SELECTION_BENCHMARK_VERSION =
  "gonggamline-item-selection-benchmark-v1" as const;

export type ItemSelectionBenchmarkCandidate = Readonly<{
  providerItemNumber: string;
  relevance: number;
  observedContributionMarginRate: number | null;
}>;

export type ItemSelectionBenchmarkPrediction = Readonly<{
  providerItemNumber: string;
  verdict: ItemSelectionVerdict;
  score: number | null;
}>;

export type ItemSelectionBenchmarkResult = Readonly<{
  version: typeof ITEM_SELECTION_BENCHMARK_VERSION;
  candidateCount: number;
  labeledCandidateCount: number;
  topK: number;
  precisionAtK: number | null;
  recallAtK: number | null;
  ndcgAtK: number | null;
  coverage: number;
  meanAbsoluteMarginError: number | null;
  eligibleForDecision: boolean;
  limitations: readonly string[];
}>;

export type ItemSelectionBenchmarkComparison = Readonly<{
  engine: ItemSelectionBenchmarkResult;
  baseline: ItemSelectionBenchmarkResult;
  precisionAtKLift: number | null;
  ndcgAtKLift: number | null;
  marginErrorImprovement: number | null;
}>;

const RECOMMENDABLE = new Set<ItemSelectionVerdict>([
  "RECOMMEND",
  "CONDITIONAL",
]);

function rounded(value: number, digits = 4): number {
  const scale = 10 ** digits;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

function assertCandidate(candidate: ItemSelectionBenchmarkCandidate): void {
  if (!/^\d{1,20}$/.test(candidate.providerItemNumber)) {
    throw new RangeError("providerItemNumber must contain 1 to 20 digits.");
  }
  if (!Number.isFinite(candidate.relevance) || candidate.relevance < 0 || candidate.relevance > 3) {
    throw new RangeError("relevance must be between 0 and 3.");
  }
  if (candidate.observedContributionMarginRate !== null && !Number.isFinite(candidate.observedContributionMarginRate)) {
    throw new RangeError("observedContributionMarginRate must be finite or null.");
  }
}

function assertPrediction(prediction: ItemSelectionBenchmarkPrediction): void {
  if (!/^\d{1,20}$/.test(prediction.providerItemNumber)) {
    throw new RangeError("providerItemNumber must contain 1 to 20 digits.");
  }
  if (prediction.score !== null && (!Number.isFinite(prediction.score) || prediction.score < 0 || prediction.score > 100)) {
    throw new RangeError("score must be between 0 and 100 or null.");
  }
}

function orderedPredictions(
  predictions: readonly ItemSelectionBenchmarkPrediction[],
): ItemSelectionBenchmarkPrediction[] {
  return [...predictions].sort((left, right) =>
    (RECOMMENDABLE.has(left.verdict) ? 0 : 1) - (RECOMMENDABLE.has(right.verdict) ? 0 : 1) ||
    (right.score ?? -1) - (left.score ?? -1) ||
    left.providerItemNumber.localeCompare(right.providerItemNumber, "en", { numeric: true }),
  );
}

function relevanceById(candidates: readonly ItemSelectionBenchmarkCandidate[]): Map<string, number> {
  return new Map(candidates.map((candidate) => [candidate.providerItemNumber, candidate.relevance]));
}

/**
 * Evaluates an Item Selection ranking against observed outcomes. This is
 * intentionally pure and read-only: it never changes verdicts or writes data.
 * Relevance labels must come from an approved, immutable evaluation dataset.
 */
export function evaluateItemSelectionBenchmark(
  candidates: readonly ItemSelectionBenchmarkCandidate[],
  predictions: readonly ItemSelectionBenchmarkPrediction[],
  topK: number,
): ItemSelectionBenchmarkResult {
  if (!Number.isSafeInteger(topK) || topK <= 0) throw new RangeError("topK must be positive.");
  candidates.forEach(assertCandidate);
  predictions.forEach(assertPrediction);
  const candidateIds = new Set(candidates.map((candidate) => candidate.providerItemNumber));
  if (candidateIds.size !== candidates.length) throw new RangeError("candidate IDs must be unique.");
  if (predictions.some((prediction) => !candidateIds.has(prediction.providerItemNumber))) {
    throw new RangeError("predictions must reference benchmark candidates.");
  }
  const relevance = relevanceById(candidates);
  const ordered = orderedPredictions(predictions);
  const cutoff = ordered.slice(0, Math.min(topK, ordered.length));
  const relevantIds = new Set(candidates.filter((candidate) => candidate.relevance >= 2).map((candidate) => candidate.providerItemNumber));
  const hits = cutoff.filter((prediction) => (relevance.get(prediction.providerItemNumber) ?? 0) >= 2).length;
  const precisionAtK = cutoff.length === 0 ? null : rounded(hits / cutoff.length);
  const recallAtK = relevantIds.size === 0 ? null : rounded(hits / relevantIds.size);
  const ideal = [...relevance.values()].sort((left, right) => right - left).slice(0, cutoff.length);
  const dcg = cutoff.reduce((sum, prediction, index) => sum + (2 ** (relevance.get(prediction.providerItemNumber) ?? 0) - 1) / Math.log2(index + 2), 0);
  const idcg = ideal.reduce((sum, value, index) => sum + (2 ** value - 1) / Math.log2(index + 2), 0);
  const ndcgAtK = idcg === 0 ? null : rounded(dcg / idcg);
  const marginErrors = cutoff.flatMap((prediction) => {
    const candidate = candidates.find((item) => item.providerItemNumber === prediction.providerItemNumber);
    return candidate?.observedContributionMarginRate !== null && candidate?.observedContributionMarginRate !== undefined && prediction.score !== null
      ? [Math.abs(prediction.score / 100 - candidate.observedContributionMarginRate)]
      : [];
  });
  const labeledCandidateCount = candidates.filter((candidate) => candidate.relevance > 0 || candidate.observedContributionMarginRate !== null).length;
  const coverage = candidates.length === 0 ? 0 : rounded(predictions.length / candidates.length);
  const limitations = [
    "이 결과는 제공된 라벨 데이터셋에만 유효하며 시장 전체 성능을 보장하지 않습니다.",
    "라벨이 없거나 실판매·반품·정산 데이터가 없으면 경쟁력 판정에 사용할 수 없습니다.",
    "실험군과 비교군의 동일한 후보 집합·관측기간·정책 버전이 필요합니다.",
  ];
  return Object.freeze({
    version: ITEM_SELECTION_BENCHMARK_VERSION,
    candidateCount: candidates.length,
    labeledCandidateCount,
    topK,
    precisionAtK,
    recallAtK,
    ndcgAtK,
    coverage,
    meanAbsoluteMarginError: marginErrors.length === 0 ? null : rounded(marginErrors.reduce((sum, value) => sum + value, 0) / marginErrors.length),
    eligibleForDecision: labeledCandidateCount >= Math.min(30, Math.max(10, topK * 2)) && precisionAtK !== null && ndcgAtK !== null,
    limitations: Object.freeze(limitations),
  });
}

/** Compares two read-only rankings over the exact same labeled dataset. */
export function compareItemSelectionBenchmarks(
  candidates: readonly ItemSelectionBenchmarkCandidate[],
  engine: readonly ItemSelectionBenchmarkPrediction[],
  baseline: readonly ItemSelectionBenchmarkPrediction[],
  topK: number,
): ItemSelectionBenchmarkComparison {
  const engineResult = evaluateItemSelectionBenchmark(candidates, engine, topK);
  const baselineResult = evaluateItemSelectionBenchmark(candidates, baseline, topK);
  const delta = (left: number | null, right: number | null): number | null =>
    left === null || right === null ? null : rounded(left - right);
  return Object.freeze({
    engine: engineResult,
    baseline: baselineResult,
    precisionAtKLift: delta(engineResult.precisionAtK, baselineResult.precisionAtK),
    ndcgAtKLift: delta(engineResult.ndcgAtK, baselineResult.ndcgAtK),
    marginErrorImprovement: delta(baselineResult.meanAbsoluteMarginError, engineResult.meanAbsoluteMarginError),
  });
}
