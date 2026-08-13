import type { ListingExperimentDecision, ListingRevisionMetrics } from "@/shared/domain/listing-learning";

export function evaluateSequentialRevision(metrics: readonly ListingRevisionMetrics[], minimumImpressions: number, maximumReturnRate: number): ListingExperimentDecision {
  const reasons: string[] = [];
  if (metrics.length < 2 || metrics.some(({ impressions }) => impressions < minimumImpressions)) reasons.push("TRAFFIC_SUFFICIENCY_NOT_MET");
  if (metrics.some((entry) => entry.attributableProfit <= 0)) reasons.push("ATTRIBUTABLE_PROFIT_GUARDRAIL_FAILED");
  if (metrics.some((entry) => entry.orders > 0 && (entry.returns + entry.refunds) / entry.orders > maximumReturnRate)) reasons.push("RETURN_GUARDRAIL_FAILED");
  return { status: reasons.includes("TRAFFIC_SUFFICIENCY_NOT_MET") ? "INSUFFICIENT_TRAFFIC" : reasons.length > 0 ? "GUARDRAIL_FAILED" : "ELIGIBLE_FOR_HUMAN_REVIEW", winnerDeclared: false, reasons };
}
