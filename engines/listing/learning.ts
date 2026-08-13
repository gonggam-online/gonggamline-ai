import type { ListingExperimentDecision, ListingRevisionMetrics, ListingRevisionPerformance } from "@/shared/domain/listing-learning";

export function deriveRevisionPerformance(entry: ListingRevisionMetrics): ListingRevisionPerformance {
  return {
    revisionId: entry.revisionId,
    clickThroughRate: entry.impressions > 0 ? entry.clicks / entry.impressions : null,
    conversionRate: entry.clicks > 0 ? entry.orders / entry.clicks : null,
    cancellationRate: entry.orders > 0 ? entry.cancellations / entry.orders : null,
    returnRefundRate: entry.orders > 0 ? (entry.returns + entry.refunds) / entry.orders : null,
    attributableProfit: entry.attributableProfit,
  };
}

export function evaluateSequentialRevision(metrics: readonly ListingRevisionMetrics[], minimumImpressions: number, maximumReturnRate: number, maximumCancellationRate = 0.2): ListingExperimentDecision {
  const reasons: string[] = [];
  const identities = new Set<string>();
  if (metrics.some((entry) => {
    const key = `${entry.eventId}:${entry.revisionId}`;
    if (identities.has(key)) return true;
    identities.add(key);
    return !entry.eventId || !entry.packetId || !entry.recordedAt || !Number.isFinite(Date.parse(entry.recordedAt));
  })) reasons.push("APPEND_ONLY_EVENT_IDENTITY_INVALID");
  if (metrics.length < 2 || metrics.some(({ impressions }) => impressions < minimumImpressions)) reasons.push("TRAFFIC_SUFFICIENCY_NOT_MET");
  if (metrics.some((entry) => entry.attributableProfit <= 0)) reasons.push("ATTRIBUTABLE_PROFIT_GUARDRAIL_FAILED");
  if (metrics.some((entry) => entry.orders > 0 && entry.cancellations / entry.orders > maximumCancellationRate)) reasons.push("CANCELLATION_GUARDRAIL_FAILED");
  if (metrics.some((entry) => entry.orders > 0 && (entry.returns + entry.refunds) / entry.orders > maximumReturnRate)) reasons.push("RETURN_GUARDRAIL_FAILED");
  return { status: reasons.includes("TRAFFIC_SUFFICIENCY_NOT_MET") ? "INSUFFICIENT_TRAFFIC" : reasons.length > 0 ? "GUARDRAIL_FAILED" : "ELIGIBLE_FOR_HUMAN_REVIEW", winnerDeclared: false, reasons, performance: metrics.map(deriveRevisionPerformance) };
}
