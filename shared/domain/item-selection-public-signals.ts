import type { ItemSelectionEvidence, ItemSelectionScoreInputs } from "./item-selection";
import type { SupplierCatalogItem } from "./supplier-catalog";
import { estimateItemSelectionDiscoveryProfitability } from "./item-selection-discovery-profitability";
import type { CoupangMarketPriceEstimate } from "./coupang-market-price";

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}

function evidence(
  sourceField: string,
  summary: string,
  observedAt: string,
  reference: string | null,
): readonly ItemSelectionEvidence[] {
  return [{
    sourceType: "PUBLIC_SUPPLIER_CATALOG",
    sourceField,
    summary,
    observedAt,
    reference,
  }];
}

function landedUnitProxy(item: SupplierCatalogItem): number | null {
  if (item.supplierPriceKrw === null) return null;
  const quantity = item.minimumOrderQuantity && item.minimumOrderQuantity > 0
    ? item.minimumOrderQuantity
    : 1;
  return item.supplierPriceKrw + (item.shippingFeeKrw ?? 0) / quantity;
}

function priceScore(item: SupplierCatalogItem, cohort: readonly SupplierCatalogItem[]): number {
  const current = landedUnitProxy(item);
  const available = cohort
    .map(landedUnitProxy)
    .filter((value): value is number => value !== null)
    .sort((left, right) => left - right);
  if (current === null || available.length === 0) return 45;
  const lowerCount = available.filter((value) => value < current).length;
  const percentile = available.length === 1 ? 0.5 : lowerCount / (available.length - 1);
  return clamp(90 - percentile * 50);
}

function listingCompleteness(item: SupplierCatalogItem): number {
  return clamp(
    20 +
    (item.name ? 25 : 0) +
    (item.thumbnailUrl ? 20 : 0) +
    (item.productUrl ? 15 : 0) +
    (item.supplierId || item.supplierName ? 10 : 0) +
    (item.supplierPriceKrw !== null ? 10 : 0),
  );
}

function logisticsScore(item: SupplierCatalogItem): number {
  const quantity = item.minimumOrderQuantity;
  const quantityScore = quantity === null ? 45
    : quantity <= 1 ? 90
      : quantity <= 5 ? 82
        : quantity <= 10 ? 72
          : quantity <= 30 ? 55
            : 35;
  return clamp(
    quantityScore +
    (item.shippingFeeKrw !== null ? 5 : 0) +
    (item.stockStatus === "in_stock" ? 5 : item.stockStatus === "out_of_stock" ? -30 : 0),
  );
}

function supplyScore(item: SupplierCatalogItem): number {
  const stock = item.stockStatus === "in_stock" ? 75
    : item.stockStatus === "out_of_stock" ? 10
      : 45;
  return clamp(
    stock +
    (item.supplierId || item.supplierName ? 10 : 0) +
    (item.supplierPriceKrw !== null ? 10 : 0) +
    (item.availableOnDomeggook === true || item.supplyAvailable === true ? 5 : 0),
  );
}

/**
 * Builds a deterministic discovery score from facts already exposed by the
 * supplier catalogue. These are opportunity proxies, not sales authorization
 * or confirmed profitability facts.
 */
export function publicCatalogOpportunityScores(
  item: SupplierCatalogItem,
  cohort: readonly SupplierCatalogItem[],
  originalPosition: number,
  observedAt: string,
  marketSellingPrice: CoupangMarketPriceEstimate | null = null,
): ItemSelectionScoreInputs {
  const reference = item.productUrl;
  const positionRange = Math.max(1, cohort.length - 1);
  const relevanceScore = clamp(92 - (originalPosition / positionRange) * 42);
  const competitiveness = priceScore(item, cohort);
  const conversionPotential = listingCompleteness(item);
  const logisticsFit = logisticsScore(item);
  const supplyStability = supplyScore(item);
  const profitability = estimateItemSelectionDiscoveryProfitability(item, cohort, marketSellingPrice);
  const observedMarketPrice = marketSellingPrice?.status === "AVAILABLE"
    ? marketSellingPrice.predictedSellingPriceKrw
    : null;
  const marketProfitabilityScore = observedMarketPrice === null
    ? null
    : observedMarketPrice >= (profitability.floorSellingPriceKrw.recommend ?? Number.POSITIVE_INFINITY)
      ? 90
      : observedMarketPrice >= (profitability.floorSellingPriceKrw.conditional ?? Number.POSITIVE_INFINITY)
        ? 75
        : observedMarketPrice >= (profitability.floorSellingPriceKrw.breakEven ?? Number.POSITIVE_INFINITY)
          ? 55
          : 20;

  return {
    competitiveness: {
      status: "AVAILABLE",
      normalizedScore: competitiveness,
      evidence: evidence(
        "supplierPriceKrw,shippingFeeKrw,minimumOrderQuantity",
        "공개 공급가·배송비·최소수량을 동일 검색 후보군 안에서 비교한 조달가격 기회 점수입니다.",
        observedAt,
        reference,
      ),
    },
    profitability: {
      ...(profitability.status === "ESTIMATED" && (marketProfitabilityScore ?? profitability.profitabilityPotentialScore) !== null
        ? {
            status: "AVAILABLE" as const,
            normalizedScore: marketProfitabilityScore ?? profitability.profitabilityPotentialScore ?? 0,
            evidence: marketProfitabilityScore === null
              ? evidence(
                  "supplierPriceKrw,shippingFeeKrw,minimumOrderQuantity,approvedCostAssumptions",
                  "공개 조달비와 승인된 보수적 비용 가정으로 필요한 판매가 하한을 계산해 후보군 안에서 비교한 사전 수익성 점수입니다. 확정 이익이 아닙니다.",
                  observedAt,
                  reference,
                )
              : [{
                  sourceType: "MARKETPLACE_PUBLIC",
                  sourceField: "coupangObservedPriceMedian",
                  summary: "현재 공개 쿠팡 관찰 가격 중앙값을 손익분기·조건부·추천 판매가 하한과 비교한 사전 수익성 점수입니다.",
                  observedAt: marketSellingPrice?.observedAt ?? observedAt,
                  reference: marketSellingPrice?.sourceReference ?? null,
                }],
          }
        : { status: "UNAVAILABLE" as const, missingFacts: ["supplierUnitCost"] }),
    },
    demand: {
      status: "AVAILABLE",
      normalizedScore: relevanceScore,
      evidence: evidence(
        "providerSearchPosition",
        "공급처 공개 검색 결과의 키워드 연관 순서를 사용한 탐색 우선순위 점수입니다.",
        observedAt,
        reference,
      ),
    },
    conversionPotential: {
      status: "AVAILABLE",
      normalizedScore: conversionPotential,
      evidence: evidence(
        "name,thumbnailUrl,productUrl,supplierIdentity,price",
        "공개 상품정보의 완성도를 사용한 상세 검토 가능성 점수입니다.",
        observedAt,
        reference,
      ),
    },
    logisticsFit: {
      status: "AVAILABLE",
      normalizedScore: logisticsFit,
      evidence: evidence(
        "minimumOrderQuantity,shippingFeeKrw,stockStatus",
        "공개 최소수량·배송비·재고 상태를 사용한 초기 물류 적합성 점수입니다.",
        observedAt,
        reference,
      ),
    },
    supplyStability: {
      status: "AVAILABLE",
      normalizedScore: supplyStability,
      evidence: evidence(
        "stockStatus,supplierIdentity,availability",
        "현재 공개 재고·공급처 식별·판매 가능 상태를 사용한 공급 신호 점수입니다.",
        observedAt,
        reference,
      ),
    },
  };
}
