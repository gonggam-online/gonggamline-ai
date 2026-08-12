# Changelog - Item Selection Profitability v3

## 2026-08-12

- Added a fail-closed pre-purchase profitability gate using a fresh confirmed
  identical-product delivered market price and same-unit comparison.
- Required the market-price scenario to pass recommend thresholds before a
  sample can become eligible for purchase review.
- Restricted the sample quantity to the verified supplier MOQ.
- Kept every payment, order, provider, warehouse, and other commerce write
  outside the gate and subject to separate approval.
- Corrected KK946 from a hypothetical `11,800 KRW` recommendation to a
  single-unit market-price rejection at `4,290 KRW` delivered.
- Added regression tests for missing/stale/comparable evidence, quantity
  limits, profitable pass, unprofitable fail, and the KK946 loss scenario.
