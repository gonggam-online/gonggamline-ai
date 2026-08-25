import { ITEM_SELECTION_PROFITABILITY_POLICY } from "../../lib/revenue/item-selection-profitability";
import type { SupplierCatalogItem } from "./supplier-catalog";
import type { CoupangMarketPriceEstimate } from "./coupang-market-price";

export const ITEM_SELECTION_DISCOVERY_PROFITABILITY_VERSION =
  "gonggamline-discovery-profitability-2026-08-25-v1" as const;

export type ItemSelectionDiscoveryProfitabilityEstimate = Readonly<{
  version: typeof ITEM_SELECTION_DISCOVERY_PROFITABILITY_VERSION;
  status: "ESTIMATED" | "UNAVAILABLE";
  floorSellingPriceKrw: Readonly<{
    breakEven: number | null;
    conditional: number | null;
    recommend: number | null;
  }>;
  costsPerUnitKrw: Readonly<{
    supplier: number | null;
    supplierInboundBase: number | null;
    supplierInboundStress: number | null;
    inboundInspectionBase: number;
    inboundInspectionStress: number;
    fulfillmentBase: number;
    fulfillmentStress: number;
    otherBase: number;
    otherStress: number;
  }>;
  rates: Readonly<{ base: number; stress: number }>;
  profitabilityPotentialScore: number | null;
  marketSellingPrice: CoupangMarketPriceEstimate | null;
  assumptions: readonly string[];
  missingActualFacts: readonly string[];
  sourceReferences: readonly string[];
}>;

const DISCOVERY_COSTS = Object.freeze({
  supplierInboundFallbackBaseKrw: 3_000,
  supplierInboundFallbackStressKrw: 5_000,
  inboundInspectionBaseKrw: 250,
  inboundInspectionStressKrw: 400,
  otherBaseKrw: 0,
  otherStressKrw: 200,
});

function roundUp100(value: number): number {
  return Math.ceil(value / 100) * 100;
}

function quantity(item: SupplierCatalogItem): number {
  return item.minimumOrderQuantity && item.minimumOrderQuantity > 0
    ? item.minimumOrderQuantity
    : 1;
}

function rawEstimate(item: SupplierCatalogItem) {
  if (item.supplierPriceKrw === null || item.supplierPriceKrw <= 0) return null;
  const orderQuantity = quantity(item);
  const supplierInboundBase = (item.shippingFeeKrw ??
    DISCOVERY_COSTS.supplierInboundFallbackBaseKrw) / orderQuantity;
  const supplierInboundStress = Math.max(
    supplierInboundBase,
    (item.shippingFeeKrw ?? DISCOVERY_COSTS.supplierInboundFallbackStressKrw) / orderQuantity,
  );
  const baseFixed = item.supplierPriceKrw + supplierInboundBase +
    DISCOVERY_COSTS.inboundInspectionBaseKrw +
    ITEM_SELECTION_PROFITABILITY_POLICY.threePlBaseKrw +
    DISCOVERY_COSTS.otherBaseKrw;
  const stressFixed = item.supplierPriceKrw + supplierInboundStress +
    DISCOVERY_COSTS.inboundInspectionStressKrw +
    ITEM_SELECTION_PROFITABILITY_POLICY.threePlStressKrw +
    DISCOVERY_COSTS.otherStressKrw;
  const baseRate = ITEM_SELECTION_PROFITABILITY_POLICY.fallbackMarketplaceFeeRate +
    ITEM_SELECTION_PROFITABILITY_POLICY.advertisingBaseRate + 0.04;
  const stressRate = ITEM_SELECTION_PROFITABILITY_POLICY.fallbackMarketplaceFeeRate +
    ITEM_SELECTION_PROFITABILITY_POLICY.advertisingStressRate + 0.06;
  const breakEven = roundUp100(baseFixed / (1 - baseRate));
  const conditional = roundUp100(Math.max(
    (baseFixed + ITEM_SELECTION_PROFITABILITY_POLICY.conditionalMinimumContributionKrw) /
      (1 - baseRate),
    baseFixed / (1 - baseRate - ITEM_SELECTION_PROFITABILITY_POLICY.conditionalMinimumMarginRate),
    stressFixed / (1 - stressRate),
  ));
  const recommend = roundUp100(Math.max(
    (baseFixed + ITEM_SELECTION_PROFITABILITY_POLICY.recommendMinimumContributionKrw) /
      (1 - baseRate),
    baseFixed / (1 - baseRate - ITEM_SELECTION_PROFITABILITY_POLICY.recommendMinimumMarginRate),
    stressFixed /
      (1 - stressRate - ITEM_SELECTION_PROFITABILITY_POLICY.recommendMinimumStressMarginRate),
  ));
  return { supplierInboundBase, supplierInboundStress, baseRate, stressRate, breakEven, conditional, recommend };
}

function potentialScore(item: SupplierCatalogItem, cohort: readonly SupplierCatalogItem[]): number | null {
  const current = rawEstimate(item)?.recommend;
  if (current === undefined || current === null) return null;
  const available = cohort
    .map((entry) => rawEstimate(entry)?.recommend)
    .filter((value): value is number => value !== undefined && value !== null)
    .sort((left, right) => left - right);
  if (available.length <= 1) return 70;
  const lowerCount = available.filter((value) => value < current).length;
  return Math.round((90 - (lowerCount / (available.length - 1)) * 45) * 10) / 10;
}

export function estimateItemSelectionDiscoveryProfitability(
  item: SupplierCatalogItem,
  cohort: readonly SupplierCatalogItem[],
  marketSellingPrice: CoupangMarketPriceEstimate | null = null,
): ItemSelectionDiscoveryProfitabilityEstimate {
  const estimate = rawEstimate(item);
  const missingActualFacts = [
    ...(item.minimumOrderQuantity === null ? ["minimumOrderQuantity"] : []),
    ...(item.shippingFeeKrw === null ? ["supplierShippingFee"] : []),
    "productDimensionsAndWeight",
    "categoryMarketplaceFee",
    "actualFulfillmentQuote",
    "actualReturnLoss",
    "actualAdvertisingRate",
  ];
  if (!estimate) {
    return Object.freeze({
      version: ITEM_SELECTION_DISCOVERY_PROFITABILITY_VERSION,
      status: "UNAVAILABLE",
      floorSellingPriceKrw: { breakEven: null, conditional: null, recommend: null },
      costsPerUnitKrw: {
        supplier: null,
        supplierInboundBase: null,
        supplierInboundStress: null,
        inboundInspectionBase: DISCOVERY_COSTS.inboundInspectionBaseKrw,
        inboundInspectionStress: DISCOVERY_COSTS.inboundInspectionStressKrw,
        fulfillmentBase: ITEM_SELECTION_PROFITABILITY_POLICY.threePlBaseKrw,
        fulfillmentStress: ITEM_SELECTION_PROFITABILITY_POLICY.threePlStressKrw,
        otherBase: DISCOVERY_COSTS.otherBaseKrw,
        otherStress: DISCOVERY_COSTS.otherStressKrw,
      },
      rates: { base: 0, stress: 0 },
      profitabilityPotentialScore: null,
      marketSellingPrice,
      assumptions: Object.freeze([]),
      missingActualFacts: Object.freeze(["supplierUnitCost", ...missingActualFacts]),
      sourceReferences: Object.freeze(["item-selection-profitability-policy-v4"]),
    });
  }
  return Object.freeze({
    version: ITEM_SELECTION_DISCOVERY_PROFITABILITY_VERSION,
    status: "ESTIMATED",
    floorSellingPriceKrw: {
      breakEven: estimate.breakEven,
      conditional: estimate.conditional,
      recommend: estimate.recommend,
    },
    costsPerUnitKrw: {
      supplier: item.supplierPriceKrw,
      supplierInboundBase: estimate.supplierInboundBase,
      supplierInboundStress: estimate.supplierInboundStress,
      inboundInspectionBase: DISCOVERY_COSTS.inboundInspectionBaseKrw,
      inboundInspectionStress: DISCOVERY_COSTS.inboundInspectionStressKrw,
      fulfillmentBase: ITEM_SELECTION_PROFITABILITY_POLICY.threePlBaseKrw,
      fulfillmentStress: ITEM_SELECTION_PROFITABILITY_POLICY.threePlStressKrw,
      otherBase: DISCOVERY_COSTS.otherBaseKrw,
      otherStress: DISCOVERY_COSTS.otherStressKrw,
    },
    rates: { base: estimate.baseRate, stress: estimate.stressRate },
    profitabilityPotentialScore: potentialScore(item, cohort),
    marketSellingPrice,
    assumptions: Object.freeze([
      "공개 공급가와 공개 배송비를 최소주문수량으로 안분합니다.",
      "배송비가 없으면 주문당 3,000원(기준)·5,000원(스트레스)을 추정합니다.",
      "검수·입고 250원(기준)·400원(스트레스), 3PL 3,000원·3,500원을 적용합니다.",
      "쿠팡 수수료 10.9%, 광고 12.5%·18%, 반품손실 4%·6%를 적용합니다.",
      ...(marketSellingPrice?.status === "AVAILABLE"
        ? ["네이버 공식 쇼핑검색에 현재 노출된 쿠팡 판매 상품의 제목 일치 가격 중앙값을 예상 실판매가로 사용합니다."]
        : []),
    ]),
    missingActualFacts: Object.freeze(missingActualFacts),
    sourceReferences: Object.freeze([
      "item-selection-profitability-policy-v4",
      "verified-inbound-inspection-evidence-class",
    ]),
  });
}
