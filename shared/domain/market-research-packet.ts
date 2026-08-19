import {
  analyzeMarketOpportunity,
  type MarketOpportunityInput,
  type MarketOpportunityResult,
} from "./market-opportunity-analysis";
import {
  buildMarketResearchPlan,
  type MarketResearchCandidate,
  type MarketResearchPlan,
  type MarketResearchSource,
} from "./market-research-plan";

export const MARKET_RESEARCH_PACKET_VERSION =
  "gonggamline-market-research-packet-v1" as const;

export type MarketResearchPacket = Readonly<{
  version: typeof MARKET_RESEARCH_PACKET_VERSION;
  opportunity: MarketOpportunityResult;
  plan: MarketResearchPlan;
  recommendation: "REVIEW_NOW" | "RESEARCH_NEXT" | "DO_NOT_PRIORITIZE";
  reasons: readonly string[];
}>;

/**
 * Combines the current evidence score with the next lawful acquisition plan.
 * This deliberately keeps promising candidates in the research lane when
 * economics are incomplete; it does not alter a live Item Selection verdict.
 */
export function buildMarketResearchPacket(
  candidate: MarketResearchCandidate,
  opportunity: MarketOpportunityInput,
  sources: readonly MarketResearchSource[],
  now = new Date(),
): MarketResearchPacket {
  if (candidate.providerItemNumber !== opportunity.providerItemNumber) {
    throw new RangeError("candidate and opportunity item numbers must match.");
  }
  const analyzed = analyzeMarketOpportunity(opportunity, now);
  const plan = buildMarketResearchPlan(candidate, sources);
  const recommendation = analyzed.status === "NOT_ECONOMIC"
    ? "DO_NOT_PRIORITIZE"
    : analyzed.status === "ACTIONABLE" && plan.blockers.length === 0
      ? "REVIEW_NOW"
      : "RESEARCH_NEXT";
  return Object.freeze({
    version: MARKET_RESEARCH_PACKET_VERSION,
    opportunity: analyzed,
    plan,
    recommendation,
    reasons: Object.freeze([
      analyzed.status === "COST_CONFIRMATION_REQUIRED"
        ? "시장성은 유지하고 공급·물류·판매 비용을 다음 연구 태스크로 넘겼습니다."
        : "현재 관측된 시장·수익성 증거를 연구 패킷에 고정했습니다.",
      plan.tasks.length === 0
        ? "추가 근거 태스크가 없습니다."
        : `다음 연구 태스크 ${plan.tasks.length}건을 출처·비용·승인 상태와 함께 정렬했습니다.`,
    ]),
  });
}
