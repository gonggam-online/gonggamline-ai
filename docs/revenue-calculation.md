# Revenue Calculation Contract

## Purpose

The Revenue Calculation Engine derives per-unit contribution profit and
low/base/high sales scenarios from fields already stored on `products`. It is a
pure, request-time calculation. Results are not persisted and no database
migration is required.

## Product field mapping

| Calculation input | Product field | Rule |
|---|---|---|
| `unitSellingPrice` | `manual_sale_price`, otherwise `estimated_sale_price` | Manual price is authoritative when present |
| `unitProductCost` | `supply_price` | Stored product cost |
| `unitPlatformFee` | `marketplace_fee` | Stored fee amount is authoritative |
| `unitAdvertisingCost` | `advertising_cost` | Zero is valid |
| `unitLogisticsCost` | `logistics_cost` | Zero is valid |
| `unitOtherCost` | `return_reserve` | Return reserve is classified as other cost |
| `estimatedSalesLow/High` | `estimated_monthly_units_low/high` | Both are required |
| `estimatedSalesBase` | `estimated_monthly_units_base` | Optional; currently absent from known Product schema |

Numeric database strings are accepted because Supabase `numeric` values may
cross the API boundary as strings. Empty strings, non-numeric strings, `NaN`,
and infinity are invalid or missing as appropriate.

## Formulas and units

All money is KRW and rounded to the nearest won. Contribution margin is a
percentage on a `0..100` scale and is rounded to one decimal place, matching
the existing Product `margin_rate` convention.

```text
unitPlatformFee = unitSellingPrice * platformFeeRate

unitTotalCost =
  unitProductCost
  + unitPlatformFee
  + unitAdvertisingCost
  + unitLogisticsCost
  + unitOtherCost

unitContributionProfit = unitSellingPrice - unitTotalCost
contributionMarginRate = unitContributionProfit / unitSellingPrice * 100
estimatedRevenue = unitSellingPrice * estimatedSales
estimatedProfit = unitContributionProfit * estimatedSales
```

`platformFeeRate` is fractional (`0..1`). A caller may supply either a stored
fee amount or a fee rate. If both are supplied, the result is `incomplete`
because the repository has no authoritative precedence rule.

## Status

- `ready`: all required inputs are valid and base sales are explicit.
- `estimated`: all required inputs are valid and base sales use the low/high
  midpoint (`salesEstimateMethod: "range_midpoint"`).
- `incomplete`: required input or authoritative fee-source information is
  missing.
- `invalid`: an input is non-finite, negative where prohibited, selling price
  is zero, fee rate is outside `0..1`, or low sales exceed high sales.

Zero costs and zero expected sales are valid. A zero selling price is invalid.
The result contains `missingFields`, `invalidFields`, and `assumptions`; the
pure function does not add a calculation timestamp.

## API

The existing `GET /api/products` response remains unchanged by default. Clients
may opt in with:

```text
GET /api/products?includeRevenueCalculation=true
```

Each product then includes a `revenueCalculation` DTO. The calculation is
performed in the service mapping path and is not stored.

## ROI

ROI has no approved denominator or period definition. The DTO therefore returns
`roi: null` and `roiDefinitionStatus: "undefined"`. This engine does not invent
an ROI or a Revenue Score.
