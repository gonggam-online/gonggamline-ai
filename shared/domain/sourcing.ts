export type SupplierChannel = "domestic_wholesale" | "consignment" | "oem" | "import" | "manual";
export type QuoteCurrency = "KRW" | "USD" | "CNY";

export interface SupplierQuote {
  id: string;
  supplierId: string;
  productId: string;
  channel: SupplierChannel;
  unitCost: number;
  moq: number;
  leadTimeDays: number;
  shippingCost: number;
  currency: QuoteCurrency;
  validUntil?: string;
}

export interface SourcingCostInput {
  unitCost: number;
  moq: number;
  exchangeRate: number;
  domesticShippingTotal: number;
  internationalShippingTotal: number;
  customsTotal: number;
  vatTotal: number;
  inspectionTotal: number;
  packagingTotal: number;
  labelingTotal: number;
  threePlInboundTotal: number;
  threePlStoragePerUnit: number;
  threePlOutboundPerUnit: number;
  coupangFeeRate: number;
  expectedReturnRate: number;
  leadTimeDays: number;
}

export interface SourcingDecision {
  productId: string;
  selectedQuoteId?: string;
  landedUnitCost?: number;
  expectedMarginRate?: number;
  approved: boolean;
  reasons: string[];
}
