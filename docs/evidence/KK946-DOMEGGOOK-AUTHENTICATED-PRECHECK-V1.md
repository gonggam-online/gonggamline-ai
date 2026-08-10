# KK946 Domeggook authenticated precheck v1

## Decision

- Observation: `2026-08-10` KST, authenticated business-account item view.
- Supplier catalog binding: `VERIFIED` for Domeggook item `56288849` as the
  owner-selected KK946 supplier listing.
- Intended option: black was visible and selectable, but a distinct provider
  option/SKU code was not exposed. Purchased-option binding remains `UNKNOWN`.
- Disposition: `QUARANTINED`.
- Supplier inquiry is not required for ordinary resale when the catalog facts
  are internally consistent and the page explicitly permits detail-image use.
- Order, payment, paid inspection, warehouse instruction, listing, and
  fulfillment remain separately approval-gated.

Only sanitized visible facts are recorded below. No account identity, supplier
contact details, address, business registration number, raw page capture,
image, credential, cookie, private message, or provider payload was retained.

## Sanitized catalog facts

| Field | Authenticated visible result | Admission |
|---|---|---|
| provider item | Domeggook `56288849` | verified catalog identity |
| catalog model | `KK946` | catalog claim bound to the item |
| title | mini charger/cable organizer pouch | catalog claim |
| supplier/manufacturer display | KLAND / `KLAND` | catalog claim |
| intended color | black | visible option label only |
| black option stock | `7,432` units | timestamped catalog availability claim |
| other option | white, `6,560` units | confirms a multi-option listing |
| total visible stock | `13,992` units | timestamped catalog availability claim |
| distinct option/SKU code | not exposed | `UNKNOWN` |
| MOQ | `6` units | authenticated catalog term |
| unit price at MOQ | `850 KRW` | authenticated catalog term |
| volume tier | `840 KRW` from `500` units | catalog term; not relevant to sample approval |
| dispatch | same-day; reported average `0.2` days | catalog service claim |
| shipping | parcel, paid with order, quantity-proportional | catalog term |
| base shipping | `3,000 KRW` through 100 units; another `3,000 KRW` per 100 | catalog term |
| remote-area surcharge | Jeju `+3,000 KRW`; island/mountain `+10,000 KRW` | catalog term |
| combined shipping | allowed only from the same origin | catalog term |
| tax status | general taxable seller / taxable product | seller catalog classification |
| VAT/tax | taxable product; checkout states that VAT-included prices support input-tax credit | transaction document remains authoritative |
| tax evidence path | cash-receipt options are shown at checkout | select the approved evidence path during payment |

For six units, the authenticated checkout fixes `5,100 KRW` merchandise plus
`3,000 KRW` prepaid shipping, or `8,100 KRW` total before any payment-provider
adjustment. No point or e-money deduction was applied. This is an approval
packet, not an order or payment authorization.

## Product, notice, and return claims

- Material: polyester.
- Manufacturer: KLAND.
- Country of manufacture/origin: China OEM / imported from Asia-China.
- Product type: pouch.
- Color, size, handling, quality warranty, service contact, withdrawal terms,
  and detailed exchange/refund terms are largely stated as “see details.” They
  are not admitted as complete product or notice evidence.
- The displayed package volume/weight value `1X1X1 / 0.1` has no trustworthy
  unit/method binding and is not admitted as measured dimensions or weight.
- Buyer-remorse return requests are allowed before purchase confirmation;
  automatic confirmation is described as the eighth day after delivery is
  confirmed.
- Buyer-remorse return shipping is `3,000 KRW`; exchange is usually twice the
  return fee but may vary. Quantity-proportional and remote-area costs require
  supplier coordination.
- Items differing from the advertisement or contract retain the platform's
  stated statutory exception window. This is a platform statement, not a
  supplier-specific defect acceptance or inspection agreement.

## Default resale and image-use rule

Ordinary resale does not require a supplier inquiry when the authenticated
catalog supplies a clear purchasable option, price, MOQ, stock, shipping, and
return terms. The authenticated page explicitly displays detail-image use as
`allowed`; that is admitted as permission to reuse those images for an
unchanged, truthful listing of this exact product. It does not authorize
material alteration, removal of marks, unsupported claims, unrelated use, or
continued use after the catalog permission is withdrawn. Missing or conflicting
permission, regulated-category evidence, option identity, or product facts
must fail closed to own photography, inspection, or exceptional inquiry.

## Checkout review

- Checkout line: black, `6` units, `5,100 KRW`.
- Prepaid shipping: `3,000 KRW`.
- Exact displayed payment total: `8,100 KRW`.
- The Domeggook Rocket Growth helper populated the approved Gaemi Warehouse
  receiving destination in the checkout UI. The repository retains no address,
  phone, email, or account identifier.
- Opening checkout created one provider-side cart/draft item. No terms were
  accepted and no order, payment, supplier message, warehouse instruction, or
  download occurred.

## Gaemi Warehouse product registration

- On `2026-08-10` KST, after exact owner approval, the product was registered
  at the Icheon warehouse as `KK946 mini pouch` with the single option `black`.
- The sanitized warehouse product reference is `PJ1491663`.
- Product management showed one active product, option `black`, status
  `not received`, and zero items awaiting approval. This verifies only the
  warehouse product/option registration; it does not bind a purchased option,
  inbound lot, inspected unit, or stock quantity.
- A rights-permitted catalog representative image was resized to the warehouse
  upload constraint and submitted. The temporary local derivative was not
  retained as evidence, and no raw page capture or account data was recorded.
- No inbound application, paid inspection, point use, warehouse request,
  Domeggook order, or payment was performed.

## Sanitized return packet

### Gaemi inbound application status

- After exact owner approval, inbound application `A1296915119go` was submitted
  for warehouse product `PJ1491663`, option `black`, quantity `6`.
- Submitted unit dimensions were `10.5 x 3.6 x 6.5 cm`, expected B2B outbound
  carton was Gaemi box `1`, and full inspection was selected at the displayed
  `100 KRW` per unit (`600 KRW` plus VAT for six units).
- Gaemi shows the application as `pending inbound`. No shipment, tracking
  registration, receipt, stock, inspection result, point deduction, or inbound
  lot binding exists yet.

```text
subjectId: KK946
catalogBinding: VERIFIED
catalogItemId: 56288849
intendedOptionLabel: BLACK_OBSERVED
purchasedOptionBinding: NOT_CHECKED
optionSkuCode: UNKNOWN
transactionBinding: NOT_CHECKED
inboundBinding: NOT_CHECKED
inspectionBinding: NOT_CHECKED
documentaryFacts: INCOMPLETE
assetRights: INCOMPLETE
categorySelection: NOT_CHECKED
sellerLogistics: NOT_CHECKED
warehouseProductOption: VERIFIED_PJ1491663_BLACK_ACTIVE_NOT_RECEIVED
warehouseInboundApplication: VERIFIED_A1296915119GO_PENDING
rawEvidenceMoved: false
externalDraftWritePerformed: true
commerceWritePerformed: false
notes: GAEMI_INBOUND_APPLICATION_PENDING_ORDER_NOT_SUBMITTED
```

## Next approval boundary

The shortest next action is the separately approved `8,100 KRW` Domeggook
black-six order to the checkout-populated Gaemi destination. Supplier inquiry
is reserved for exceptions and is not required here. Order/payment execution
remains separately approved; the approved full-inspection charge applies only
after physical receipt and processing.
