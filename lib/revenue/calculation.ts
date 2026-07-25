export type RevenueCalculationStatus =
  | "ready"
  | "estimated"
  | "incomplete"
  | "invalid";

export type SalesEstimateMethod = "explicit" | "range_midpoint";

export type RoiDefinitionStatus = "undefined";

export type RevenueCalculationInput = {
  unitSellingPrice: unknown;
  unitProductCost: unknown;
  unitPlatformFee?: unknown;
  platformFeeRate?: unknown;
  unitAdvertisingCost: unknown;
  unitLogisticsCost: unknown;
  unitOtherCost: unknown;
  estimatedSalesLow: unknown;
  estimatedSalesHigh: unknown;
  estimatedSalesBase?: unknown;
};

export type RevenueCalculationResult = {
  status: RevenueCalculationStatus;
  missingFields: string[];
  invalidFields: string[];
  assumptions: string[];
  unitSellingPrice: number | null;
  unitProductCost: number | null;
  unitPlatformFee: number | null;
  unitAdvertisingCost: number | null;
  unitLogisticsCost: number | null;
  unitOtherCost: number | null;
  unitTotalCost: number | null;
  unitContributionProfit: number | null;
  contributionMarginRate: number | null;
  estimatedSalesLow: number | null;
  estimatedSalesBase: number | null;
  estimatedSalesHigh: number | null;
  estimatedRevenueLow: number | null;
  estimatedRevenueBase: number | null;
  estimatedRevenueHigh: number | null;
  estimatedProfitLow: number | null;
  estimatedProfitBase: number | null;
  estimatedProfitHigh: number | null;
  salesEstimateMethod: SalesEstimateMethod | null;
  roi: null;
  roiDefinitionStatus: RoiDefinitionStatus;
};

const MONEY_FIELDS = [
  "unitSellingPrice",
  "unitProductCost",
  "unitAdvertisingCost",
  "unitLogisticsCost",
  "unitOtherCost",
] as const;

const SALES_FIELDS = [
  "estimatedSalesLow",
  "estimatedSalesHigh",
] as const;

type RequiredMoneyField = (typeof MONEY_FIELDS)[number];
type RequiredSalesField = (typeof SALES_FIELDS)[number];

function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isMissing(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

function roundWon(value: number): number {
  return Math.round(value);
}

function roundPercent(value: number): number {
  return Math.round(value * 10) / 10;
}

function emptyResult(
  status: RevenueCalculationStatus,
  missingFields: string[],
  invalidFields: string[],
  assumptions: string[],
): RevenueCalculationResult {
  return {
    status,
    missingFields,
    invalidFields,
    assumptions,
    unitSellingPrice: null,
    unitProductCost: null,
    unitPlatformFee: null,
    unitAdvertisingCost: null,
    unitLogisticsCost: null,
    unitOtherCost: null,
    unitTotalCost: null,
    unitContributionProfit: null,
    contributionMarginRate: null,
    estimatedSalesLow: null,
    estimatedSalesBase: null,
    estimatedSalesHigh: null,
    estimatedRevenueLow: null,
    estimatedRevenueBase: null,
    estimatedRevenueHigh: null,
    estimatedProfitLow: null,
    estimatedProfitBase: null,
    estimatedProfitHigh: null,
    salesEstimateMethod: null,
    roi: null,
    roiDefinitionStatus: "undefined",
  };
}

export function calculateRevenue(
  input: RevenueCalculationInput,
): RevenueCalculationResult {
  const missingFields: string[] = [];
  const invalidFields: string[] = [];
  const assumptions: string[] = [];
  const money = {} as Record<RequiredMoneyField, number>;
  const sales = {} as Record<RequiredSalesField, number>;

  for (const field of MONEY_FIELDS) {
    if (isMissing(input[field])) {
      missingFields.push(field);
      continue;
    }
    const parsed = parseFiniteNumber(input[field]);
    if (parsed === null || parsed < 0 || (field === "unitSellingPrice" && parsed === 0)) {
      invalidFields.push(field);
      continue;
    }
    money[field] = parsed;
  }

  for (const field of SALES_FIELDS) {
    if (isMissing(input[field])) {
      missingFields.push(field);
      continue;
    }
    const parsed = parseFiniteNumber(input[field]);
    if (parsed === null || parsed < 0) {
      invalidFields.push(field);
      continue;
    }
    sales[field] = parsed;
  }

  const hasFeeAmount = !isMissing(input.unitPlatformFee);
  const hasFeeRate = !isMissing(input.platformFeeRate);
  let unitPlatformFee: number | null = null;

  if (hasFeeAmount && hasFeeRate) {
    missingFields.push("unitPlatformFeeSource");
    assumptions.push(
      "unitPlatformFee and platformFeeRate both exist; no authoritative precedence is defined.",
    );
  } else if (hasFeeAmount) {
    const parsed = parseFiniteNumber(input.unitPlatformFee);
    if (parsed === null || parsed < 0) {
      invalidFields.push("unitPlatformFee");
    } else {
      unitPlatformFee = parsed;
      assumptions.push("Stored unitPlatformFee amount is authoritative.");
    }
  } else if (hasFeeRate) {
    const parsed = parseFiniteNumber(input.platformFeeRate);
    if (parsed === null || parsed < 0 || parsed > 1) {
      invalidFields.push("platformFeeRate");
    } else if (money.unitSellingPrice !== undefined) {
      unitPlatformFee = money.unitSellingPrice * parsed;
      assumptions.push("platformFeeRate uses a 0-to-1 fractional unit.");
    }
  } else {
    missingFields.push("unitPlatformFee");
  }

  let estimatedSalesBase: number | null = null;
  let salesEstimateMethod: SalesEstimateMethod | null = null;
  if (!isMissing(input.estimatedSalesBase)) {
    const parsed = parseFiniteNumber(input.estimatedSalesBase);
    if (parsed === null || parsed < 0) {
      invalidFields.push("estimatedSalesBase");
    } else {
      estimatedSalesBase = parsed;
      salesEstimateMethod = "explicit";
    }
  } else if (
    sales.estimatedSalesLow !== undefined
    && sales.estimatedSalesHigh !== undefined
  ) {
    estimatedSalesBase =
      (sales.estimatedSalesLow + sales.estimatedSalesHigh) / 2;
    salesEstimateMethod = "range_midpoint";
    assumptions.push(
      "estimatedSalesBase is the midpoint of estimatedSalesLow and estimatedSalesHigh.",
    );
  }

  if (
    sales.estimatedSalesLow !== undefined
    && sales.estimatedSalesHigh !== undefined
    && sales.estimatedSalesLow > sales.estimatedSalesHigh
  ) {
    invalidFields.push("estimatedSalesRange");
  }

  if (invalidFields.length > 0) {
    return emptyResult("invalid", missingFields, invalidFields, assumptions);
  }
  if (missingFields.length > 0) {
    return emptyResult("incomplete", missingFields, invalidFields, assumptions);
  }

  const unitSellingPrice = roundWon(money.unitSellingPrice);
  const unitProductCost = roundWon(money.unitProductCost);
  const roundedPlatformFee = roundWon(unitPlatformFee ?? 0);
  const unitAdvertisingCost = roundWon(money.unitAdvertisingCost);
  const unitLogisticsCost = roundWon(money.unitLogisticsCost);
  const unitOtherCost = roundWon(money.unitOtherCost);
  const unitTotalCost =
    unitProductCost
    + roundedPlatformFee
    + unitAdvertisingCost
    + unitLogisticsCost
    + unitOtherCost;
  const unitContributionProfit = unitSellingPrice - unitTotalCost;
  const estimatedSalesLow = sales.estimatedSalesLow;
  const estimatedSalesHigh = sales.estimatedSalesHigh;
  const base = estimatedSalesBase ?? 0;

  return {
    status: salesEstimateMethod === "explicit" ? "ready" : "estimated",
    missingFields,
    invalidFields,
    assumptions,
    unitSellingPrice,
    unitProductCost,
    unitPlatformFee: roundedPlatformFee,
    unitAdvertisingCost,
    unitLogisticsCost,
    unitOtherCost,
    unitTotalCost,
    unitContributionProfit,
    contributionMarginRate: roundPercent(
      (unitContributionProfit / unitSellingPrice) * 100,
    ),
    estimatedSalesLow,
    estimatedSalesBase: base,
    estimatedSalesHigh,
    estimatedRevenueLow: roundWon(unitSellingPrice * estimatedSalesLow),
    estimatedRevenueBase: roundWon(unitSellingPrice * base),
    estimatedRevenueHigh: roundWon(unitSellingPrice * estimatedSalesHigh),
    estimatedProfitLow: roundWon(unitContributionProfit * estimatedSalesLow),
    estimatedProfitBase: roundWon(unitContributionProfit * base),
    estimatedProfitHigh: roundWon(unitContributionProfit * estimatedSalesHigh),
    salesEstimateMethod,
    roi: null,
    roiDefinitionStatus: "undefined",
  };
}

function field(row: Record<string, unknown>, name: string): unknown {
  return Object.prototype.hasOwnProperty.call(row, name) ? row[name] : undefined;
}

export function calculateProductRevenue(
  product: Record<string, unknown>,
): RevenueCalculationResult {
  const manualSalePrice = field(product, "manual_sale_price");
  const hasManualSalePrice = !isMissing(manualSalePrice);

  const result = calculateRevenue({
    unitSellingPrice: hasManualSalePrice
      ? manualSalePrice
      : field(product, "estimated_sale_price"),
    unitProductCost: field(product, "supply_price"),
    unitPlatformFee: field(product, "marketplace_fee"),
    unitAdvertisingCost: field(product, "advertising_cost"),
    unitLogisticsCost: field(product, "logistics_cost"),
    unitOtherCost: field(product, "return_reserve"),
    estimatedSalesLow: field(product, "estimated_monthly_units_low"),
    estimatedSalesHigh: field(product, "estimated_monthly_units_high"),
    estimatedSalesBase: field(product, "estimated_monthly_units_base"),
  });

  return {
    ...result,
    assumptions: [
      ...(hasManualSalePrice
        ? ["manual_sale_price is authoritative over estimated_sale_price."]
        : ["estimated_sale_price is used because manual_sale_price is absent."]),
      ...result.assumptions,
      "return_reserve is classified as unitOtherCost.",
    ],
  };
}

export function attachRevenueCalculations(
  products: Record<string, unknown>[],
): Record<string, unknown>[] {
  return products.map((product) => ({
    ...product,
    revenueCalculation: calculateProductRevenue(product),
  }));
}
