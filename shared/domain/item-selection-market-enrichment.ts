import type { ItemSelectionEvidence, ItemSelectionScoreInputs } from "./item-selection";

export type ItemSelectionMarketMetric = Readonly<{
  opportunityScore: number | null;
  demandScore: number | null;
  growthScore: number | null;
  supplyScore: number | null;
  confidence: number | null;
  evidence?: readonly ItemSelectionEvidence[];
}>;

function bounded(value: number | null): number | null {
  return value === null || !Number.isFinite(value) ? null : Math.min(100, Math.max(0, value));
}

function available(value: number | null, fact: string, evidence: ItemSelectionMarketMetric["evidence"]) {
  const boundedValue = bounded(value);
  return boundedValue === null
    ? { status: "UNAVAILABLE" as const, missingFacts: [`market.${fact}`] }
    : { status: "AVAILABLE" as const, normalizedScore: boundedValue, evidence: evidence ?? [] };
}

/** Maps only exact, server-read Market Intelligence metrics into existing
 * score areas. It never invents values and leaves absent facts unavailable. */
export function enrichItemSelectionScores(
  base: ItemSelectionScoreInputs,
  metric: ItemSelectionMarketMetric,
): ItemSelectionScoreInputs {
  return {
    ...base,
    competitiveness: available(metric.opportunityScore, "opportunityScore", metric.evidence),
    demand: available(metric.demandScore, "demandScore", metric.evidence),
    conversionPotential: available(metric.growthScore, "growthScore", metric.evidence),
    logisticsFit: available(metric.supplyScore, "supplyScore", metric.evidence),
    supplyStability: available(metric.confidence, "confidence", metric.evidence),
  };
}
