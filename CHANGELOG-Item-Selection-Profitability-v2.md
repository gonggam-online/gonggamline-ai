# Item Selection Profitability v2 changelog

## 2026-08-12

- Corrected Coupang marketplace-fee calculation to use the VAT-inclusive final
  price paid by the customer instead of VAT-exclusive net revenue.
- Preserved net-revenue bases for advertising and return-loss reserves.
- Added a taxable-price regression test: `22,000 KRW` final price at `10%`
  produces `20,000 KRW` net revenue and `2,200 KRW` marketplace fee.
- Versioned the high-risk policy as
  `gonggamline-profitability-2026-08-12-v2`; thresholds and fallback rate are
  unchanged.
- Reconciled KK946 against its authenticated WING `10.5%` category fee and
  moved the exact recommend threshold to `11,243 KRW` (`11,300 KRW`
  operational floor).

No database, Production, secret, category, product, price, stock, logistics,
or other marketplace write is included. Rollback is a Git revert to v1.
