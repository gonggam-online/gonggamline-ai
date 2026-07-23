import type { ProcurementScoreInput } from "@/shared/domain/procurement";

const clamp = (value: number) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

export function calculateProcurementScore(input: ProcurementScoreInput) {
  const margin = clamp(input.marginRate * 2.2);
  const reliability = clamp(input.supplierReliability);
  const moqFit = clamp(100 - Math.max(0, input.moq - 20) * 0.45);
  const leadTime = clamp(100 - Math.max(0, input.leadTimeDays - 1) * 4);
  const freshness = clamp(100 - Math.max(0, input.quoteAgeDays) * 3);
  const score = clamp(margin * 0.35 + reliability * 0.25 + moqFit * 0.15 + leadTime * 0.15 + freshness * 0.1);
  const decision = score >= 75 && input.marginRate >= 25 ? "approve" : score >= 55 && input.marginRate >= 15 ? "review" : "reject";
  const reasons = [
    `예상 순마진율 ${input.marginRate.toFixed(1)}%`,
    `공급처 신뢰도 ${Math.round(input.supplierReliability)}점`,
    `MOQ ${Math.round(input.moq)}개`,
    `리드타임 ${Math.round(input.leadTimeDays)}일`,
    `견적 신선도 ${Math.max(0, 100 - input.quoteAgeDays * 3).toFixed(0)}점`,
  ];
  return { score, decision, components: { margin, reliability, moqFit, leadTime, freshness }, reasons } as const;
}

export function buildPurchaseOrderNumber(date = new Date(), sequence = Math.floor(Math.random() * 9000) + 1000) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `GG-${y}${m}${d}-${sequence}`;
}
