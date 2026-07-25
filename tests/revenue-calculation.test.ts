import assert from "node:assert/strict";
import test from "node:test";
import {
  attachRevenueCalculations,
  calculateProductRevenue,
  calculateRevenue,
  type RevenueCalculationInput,
} from "../lib/revenue/calculation.ts";

const completeInput: RevenueCalculationInput = {
  unitSellingPrice: 20_000,
  unitProductCost: 8_000,
  unitPlatformFee: 2_200,
  unitAdvertisingCost: 1_600,
  unitLogisticsCost: 2_500,
  unitOtherCost: 600,
  estimatedSalesLow: 10,
  estimatedSalesBase: 15,
  estimatedSalesHigh: 20,
};

test("calculates a ready product with explicit base sales", () => {
  const result = calculateRevenue(completeInput);
  assert.equal(result.status, "ready");
  assert.equal(result.unitTotalCost, 14_900);
  assert.equal(result.unitContributionProfit, 5_100);
  assert.equal(result.contributionMarginRate, 25.5);
  assert.equal(result.estimatedRevenueBase, 300_000);
  assert.equal(result.estimatedProfitBase, 76_500);
  assert.equal(result.salesEstimateMethod, "explicit");
  assert.equal(result.roi, null);
  assert.equal(result.roiDefinitionStatus, "undefined");
});

test("uses a low/high midpoint and marks the result estimated", () => {
  const { estimatedSalesBase: _base, ...input } = completeInput;
  const result = calculateRevenue(input);
  assert.equal(result.status, "estimated");
  assert.equal(result.estimatedSalesBase, 15);
  assert.equal(result.salesEstimateMethod, "range_midpoint");
});

test("reports missing required costs without treating zero as missing", () => {
  const missing = calculateRevenue({
    ...completeInput,
    unitAdvertisingCost: null,
  });
  assert.equal(missing.status, "incomplete");
  assert.deepEqual(missing.missingFields, ["unitAdvertisingCost"]);

  const zeroCosts = calculateRevenue({
    ...completeInput,
    unitProductCost: 0,
    unitPlatformFee: 0,
    unitAdvertisingCost: 0,
    unitLogisticsCost: 0,
    unitOtherCost: 0,
  });
  assert.equal(zeroCosts.status, "ready");
  assert.equal(zeroCosts.unitTotalCost, 0);
});

test("reports a missing or zero selling price correctly", () => {
  assert.deepEqual(
    calculateRevenue({ ...completeInput, unitSellingPrice: null }).missingFields,
    ["unitSellingPrice"],
  );
  const zero = calculateRevenue({ ...completeInput, unitSellingPrice: 0 });
  assert.equal(zero.status, "invalid");
  assert.deepEqual(zero.invalidFields, ["unitSellingPrice"]);
});

test("rejects negative costs, inverted ranges, and non-finite values", () => {
  assert.equal(
    calculateRevenue({ ...completeInput, unitProductCost: -1 }).status,
    "invalid",
  );
  assert.deepEqual(
    calculateRevenue({
      ...completeInput,
      estimatedSalesLow: 21,
      estimatedSalesHigh: 20,
    }).invalidFields,
    ["estimatedSalesRange"],
  );
  for (const value of [Number.NaN, Number.POSITIVE_INFINITY, "not-a-number"]) {
    assert.equal(
      calculateRevenue({ ...completeInput, unitAdvertisingCost: value }).status,
      "invalid",
    );
  }
});

test("allows zero expected sales", () => {
  const result = calculateRevenue({
    ...completeInput,
    estimatedSalesLow: 0,
    estimatedSalesBase: 0,
    estimatedSalesHigh: 0,
  });
  assert.equal(result.status, "ready");
  assert.equal(result.estimatedRevenueBase, 0);
  assert.equal(result.estimatedProfitBase, 0);
});

test("calculates a platform fee from a fractional rate", () => {
  const { unitPlatformFee: _fee, ...input } = completeInput;
  const result = calculateRevenue({ ...input, platformFeeRate: 0.11 });
  assert.equal(result.status, "ready");
  assert.equal(result.unitPlatformFee, 2_200);
});

test("uses a stored fee amount and refuses ambiguous fee precedence", () => {
  const amount = calculateRevenue(completeInput);
  assert.equal(amount.unitPlatformFee, 2_200);

  const conflict = calculateRevenue({
    ...completeInput,
    platformFeeRate: 0.11,
  });
  assert.equal(conflict.status, "incomplete");
  assert.deepEqual(conflict.missingFields, ["unitPlatformFeeSource"]);
});

test("rounds money to won and margin rate to one percentage decimal", () => {
  const result = calculateRevenue({
    ...completeInput,
    unitSellingPrice: 10_001.4,
    unitProductCost: 1_000.6,
    unitPlatformFee: 1_100.4,
    unitAdvertisingCost: 800.4,
    unitLogisticsCost: 2_500.4,
    unitOtherCost: 300.4,
  });
  assert.equal(result.unitSellingPrice, 10_001);
  assert.equal(result.unitTotalCost, 5_701);
  assert.equal(result.unitContributionProfit, 4_300);
  assert.equal(result.contributionMarginRate, 43);
});

test("maps product storage fields and preserves existing unit-profit semantics", () => {
  const result = calculateProductRevenue({
    estimated_sale_price: "20000",
    supply_price: "8000",
    marketplace_fee: "2200",
    advertising_cost: "1600",
    logistics_cost: "2500",
    return_reserve: "600",
    estimated_monthly_units_low: 10,
    estimated_monthly_units_high: 20,
  });
  assert.equal(result.status, "estimated");
  assert.equal(result.unitContributionProfit, 5_100);
  assert.equal(result.contributionMarginRate, 25.5);
});

test("manual sale price takes precedence in the product mapper", () => {
  const result = calculateProductRevenue({
    manual_sale_price: 22_000,
    estimated_sale_price: 20_000,
    supply_price: 8_000,
    marketplace_fee: 2_420,
    advertising_cost: 1_760,
    logistics_cost: 2_500,
    return_reserve: 660,
    estimated_monthly_units_low: 10,
    estimated_monthly_units_high: 20,
  });
  assert.equal(result.unitSellingPrice, 22_000);
  assert.match(result.assumptions[0], /manual_sale_price/);
});

test("opt-in API mapper adds the DTO without mutating product fields", () => {
  const products = [{
    id: 7,
    estimated_sale_price: 20_000,
    supply_price: 8_000,
    marketplace_fee: 2_200,
    advertising_cost: 1_600,
    logistics_cost: 2_500,
    return_reserve: 600,
    estimated_monthly_units_low: 10,
    estimated_monthly_units_high: 20,
  }];
  const mapped = attachRevenueCalculations(products);
  assert.equal(mapped[0].id, 7);
  assert.equal(
    (mapped[0].revenueCalculation as { status: string }).status,
    "estimated",
  );
  assert.equal(Object.hasOwn(products[0], "revenueCalculation"), false);
});
