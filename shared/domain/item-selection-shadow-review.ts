import {
  evaluateMarketIntelligenceShadow,
  type MarketIntelligenceMetricSnapshot,
  type MarketIntelligenceShadowResult,
} from "./market-intelligence-shadow";
import type { ItemSelectionVerdict } from "./item-selection";

export const ITEM_SELECTION_SHADOW_REVIEW_VERSION =
  "gonggamline-item-selection-shadow-review-v1" as const;

export type ItemSelectionShadowReviewInput = Readonly<{
  providerItemNumber: string;
  currentVerdict: ItemSelectionVerdict;
  currentScore: number | null;
  market: MarketIntelligenceMetricSnapshot;
  profitabilityStatus: "CONFIRMED" | "ESTIMATED" | "INCOMPLETE" | "NOT_EVALUATED";
  contributionMarginRate: number | null;
  rightsStatus: "PASS" | "UNKNOWN" | "FAIL";
}>;

export type ItemSelectionShadowReviewPacket = Readonly<{
  version: typeof ITEM_SELECTION_SHADOW_REVIEW_VERSION;
  providerItemNumber: string;
  currentVerdict: ItemSelectionVerdict;
  currentScore: number | null;
  shadow: MarketIntelligenceShadowResult;
  operationalVerdictChanged: false;
  requiresManualReview: true;
  reasons: readonly string[];
}>;

/**
 * Compares an existing Item Selection result with market evidence without
 * changing, replacing, or authorizing the operational verdict.
 */
export function buildItemSelectionShadowReview(
  input: ItemSelectionShadowReviewInput,
  now = new Date(),
): ItemSelectionShadowReviewPacket {
  const shadow = evaluateMarketIntelligenceShadow({
    providerItemNumber: input.providerItemNumber,
    market: input.market,
    profitabilityStatus: input.profitabilityStatus,
    contributionMarginRate: input.contributionMarginRate,
    rightsStatus: input.rightsStatus,
  }, now);
  return Object.freeze({
    version: ITEM_SELECTION_SHADOW_REVIEW_VERSION,
    providerItemNumber: input.providerItemNumber,
    currentVerdict: input.currentVerdict,
    currentScore: input.currentScore,
    shadow,
    operationalVerdictChanged: false,
    requiresManualReview: true,
    reasons: Object.freeze([
      "Shadow 결과는 기존 Item Selection 운영 판정을 변경하지 않습니다.",
      shadow.decision === "PRIORITIZE_FOR_REVIEW"
        ? "시장 근거가 충분해 관리자 비교 검토 대상으로 올렸습니다."
        : "시장 근거가 부족하거나 우선순위 기준을 충족하지 못했습니다.",
    ]),
  });
}
