import type { SupplierQuote, SourcingCostInput, SourcingDecision } from "@/shared/domain/sourcing";

export * from "@/shared/domain/supplier-quote-comparison";

const safe = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;

export function calculateDetailedSourcing(input: SourcingCostInput, targetSellingPrice: number) {
  const moq = Math.max(1, Math.round(safe(input.moq)));
  const exchangeRate = Math.max(0.0001, safe(input.exchangeRate) || 1);
  const goodsUnitCost = safe(input.unitCost) * exchangeRate;
  const apportionedTotal = [
    input.domesticShippingTotal,
    input.internationalShippingTotal,
    input.customsTotal,
    input.vatTotal,
    input.inspectionTotal,
    input.packagingTotal,
    input.labelingTotal,
    input.threePlInboundTotal,
  ].reduce((sum, value) => sum + safe(value), 0) / moq;
  const landedUnitCost = goodsUnitCost + apportionedTotal + safe(input.threePlStoragePerUnit) + safe(input.threePlOutboundPerUnit);
  const sellingPrice = safe(targetSellingPrice);
  const coupangFeePerUnit = sellingPrice * Math.min(100, safe(input.coupangFeeRate)) / 100;
  const expectedReturnCostPerUnit = landedUnitCost * Math.min(100, safe(input.expectedReturnRate)) / 100;
  const expectedProfitPerUnit = sellingPrice - landedUnitCost - coupangFeePerUnit - expectedReturnCostPerUnit;
  const expectedMarginRate = sellingPrice > 0 ? expectedProfitPerUnit / sellingPrice * 100 : 0;
  const initialPurchaseAmount = goodsUnitCost * moq + apportionedTotal * moq;
  const workingCapitalDays = Math.max(0, Math.round(safe(input.leadTimeDays))) + 30;
  const score = Math.max(0, Math.min(100,
    expectedMarginRate * 1.7
    + Math.max(0, 30 - moq / 10)
    + Math.max(0, 20 - input.leadTimeDays / 2)
  ));
  const decision = expectedMarginRate >= 25 && score >= 60 ? "approve" : expectedMarginRate >= 15 ? "review" : "reject";
  const reasons = [
    `착지원가 ${Math.round(landedUnitCost).toLocaleString("ko-KR")}원`,
    `쿠팡 수수료 ${Math.round(coupangFeePerUnit).toLocaleString("ko-KR")}원`,
    `예상 순이익 ${Math.round(expectedProfitPerUnit).toLocaleString("ko-KR")}원`,
    `예상 순마진율 ${expectedMarginRate.toFixed(1)}%`,
    `초기 필요자금 ${Math.round(initialPurchaseAmount).toLocaleString("ko-KR")}원 · 자금회전 ${workingCapitalDays}일`,
  ];
  return { landedUnitCost, coupangFeePerUnit, expectedReturnCostPerUnit, expectedProfitPerUnit, expectedMarginRate, initialPurchaseAmount, workingCapitalDays, score, decision, reasons } as const;
}

export function calculateLandedUnitCost(quote: SupplierQuote): number {
  const apportionedShipping = quote.moq > 0 ? quote.shippingCost / quote.moq : quote.shippingCost;
  return Math.max(0, quote.unitCost + apportionedShipping);
}

export function rankSupplierQuotes(quotes: SupplierQuote[]): SupplierQuote[] {
  return [...quotes].sort((a, b) => {
    const costDiff = calculateLandedUnitCost(a) - calculateLandedUnitCost(b);
    if (Math.abs(costDiff) > 0.01) return costDiff;
    if (a.leadTimeDays !== b.leadTimeDays) return a.leadTimeDays - b.leadTimeDays;
    return a.moq - b.moq;
  });
}

export function buildSourcingDecision(productId: string, quote: SupplierQuote | undefined, targetSellingPrice: number): SourcingDecision {
  if (!quote) return { productId, approved: false, reasons: ["비교 가능한 공급처 견적이 없습니다."] };
  const landedUnitCost = calculateLandedUnitCost(quote);
  const expectedMarginRate = targetSellingPrice > 0 ? ((targetSellingPrice - landedUnitCost) / targetSellingPrice) * 100 : 0;
  return { productId, selectedQuoteId: quote.id, landedUnitCost, expectedMarginRate, approved: expectedMarginRate >= 25, reasons: [`도착원가 ${Math.round(landedUnitCost).toLocaleString("ko-KR")}원`, `예상 매출총이익률 ${expectedMarginRate.toFixed(1)}%`, `MOQ ${quote.moq}개 · 리드타임 ${quote.leadTimeDays}일`] };
}
