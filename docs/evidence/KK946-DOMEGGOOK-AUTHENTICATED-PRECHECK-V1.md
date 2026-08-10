# KK946 Domeggook authenticated precheck v1

## Decision

- Observation: `2026-08-10` KST, authenticated business-account item view.
- Supplier catalog binding: `VERIFIED` for Domeggook item `56288849` as the
  owner-selected KK946 supplier listing.
- Intended option: black was visible and selectable, but a distinct provider
  option/SKU code was not exposed. Purchased-option binding remains `UNKNOWN`.
- Disposition: `QUARANTINED`.
- Order, supplier contact, paid inspection, warehouse instruction, listing, and
  fulfillment: `NOT_AUTHORIZED`.

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
| VAT inclusion | not stated | `UNKNOWN` |
| tax-invoice issuance/path | not stated | `UNKNOWN` |

For six units, the visible pre-payment arithmetic is `5,100 KRW` merchandise
plus `3,000 KRW` base shipping, or `8,100 KRW`. This is not a quote, payment
authorization, or confirmed VAT treatment; the checkout total was not opened.

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

## Image rights

The authenticated page displays detail-image use as `allowed`. That statement
does not prove the policy-required exact asset bytes, grantor authority,
Coupang/marketplace and CDN/processor sharing, editing/derivative permission,
territory, term, expiry, revocation, trademarks/trade dress, or privacy status.
Therefore image use and edit rights remain `UNKNOWN`, and no supplier image may
be copied, downloaded, transformed, or published.

## Sanitized return packet

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
rawEvidenceMoved: false
commerceWritePerformed: false
notes: OPTION_CODE_VAT_INVOICE_DIMENSIONS_MARKINGS_RIGHTS_SCOPE_UNKNOWN
```

## Next approval boundary

The shortest next action is a supplier inquiry limited to the exact black
option/SKU code, VAT inclusion and tax-invoice path, exact dimensions/weight,
packaging and required markings, defect exchange terms, and image-rights scope.
Sending that inquiry is an external write and requires separate owner approval.
Purchase, payment, paid inspection, and Gaemi Warehouse instructions remain
later, separately approved actions.
