# Item Selection Profitability v4 changelog

## 2026-08-19 — Supplier and fulfillment logistics evidence wiring

- Bumped the runtime policy to `gonggamline-profitability-2026-08-19-v4`.
- Included the observed supplier shipping charge in the workflow's
  `supplierToFulfillmentInbound` cost line.
- Preserved fail-closed handling for missing Gaemi charges, missing mandatory
  variable costs, and unconfirmed Coupang category fees.
- Recorded the KK946 Gaemi/Coupang logistics evidence as a subject-bound
  reference; its values are not generalized to other products.
- No database, Auth/RLS, secret, Production, provider, payment, purchase,
  inventory, fulfillment, listing, or other commerce write was performed.
