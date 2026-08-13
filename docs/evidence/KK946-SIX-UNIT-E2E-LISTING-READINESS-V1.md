# KK946 six-unit Coupang E2E listing readiness v1

Observed: 2026-08-12 through 2026-08-13 (KST)

Status: `PROVIDER_FOLLOWUP_RECEIVED_REMAINING_FIELDS_FAIL_CLOSED`

Risk: high-risk/manual

External writes performed by this task: one informational Gaemi request and one
bounded follow-up on that same categorized thread; the provider has now replied
to both. One duplicate request was explicitly marked to ignore and was closed
by the provider. No additional inquiry, order, shipment, return, address,
listing, price, stock, advertisement, API configuration, payment, database, or
Production write occurred.

## Decision

KK946 still fails the ordinary v3 pre-purchase profitability gate. This packet
does not turn that failure into a profitable-product decision. It prepares a
bounded liquidation exception using only the six units already held at Gaemi
so the company can validate listing, sale, seller fulfillment, return handling,
and settlement end to end. No reorder is allowed.

The exact proposed experiment is one unit per offer, at both normal and sale
price `4,290 KRW`, with free customer shipping, six units maximum, no ads, no
coupon, no automatic price adjustment, no Rocket Growth inbound, and an actual
attributable loss cap of `30,000 KRW`. Exposure is limited to 14 days, with a
no-sale review at day 7. Any differing WING final summary is a stop condition.

## Verified WING read-only facts

- Account address book: `0` records. Neither an outbound place nor a
  return/exchange place exists.
- Catalog match: Coupang product `9681483612`, black, current item-winner price
  `4,290 KRW`.
- WING category path: `패션의류잡화 > 유니섹스/남녀공용 패션 > 공용 잡화 > 가방 > 남녀공용파우치`.
- Commission displayed for the selected category: `10.5%`, VAT excluded and
  applied to the final customer price.
- Required purchase options supplied by the matched black offer:
  `색상=블랙` and `패션의류/잡화 사이즈=상세페이지 참조`.
- Notice category `가방` requires 종류, 소재, 색상, 크기,
  제조자(수입자), 제조국, 취급시 주의사항, 품질보증기준, and
  A/S 책임자와 전화번호.
- No address, draft, temporary save, product, price, stock, advertisement, or
  fulfillment write was made. Auto-save remained off.

The WING UI does not expose `displayCategoryCode`, and manual catalog-matched
registration does not require the operator to invent one. An API path must use
Coupang's official Category Recommendation or category metadata source first;
the public breadcrumb number must not be substituted.

## Post-merge authenticated read-only follow-up

After PR #123 merged, the provider systems were read again without saving or
submitting anything:

- Gaemi still holds exactly six KK946 black units. Its current point balance is
  sufficient for six base outbound charges; the private balance amount is not
  copied into Git.
- The Gaemi account's Coupang API connection is `DISCONNECTED`, automatic order
  collection is disabled, and no Coupang vendor/access/secret value is stored
  there. A manual order entry remains available for the first-sale fallback,
  but it cannot prove the automated order-to-shipment loop.
- The authenticated Gaemi page and current member manual verify the Icheon
  inbound center. They do not authorize reusing that inbound identity as the
  WING customer-return record. Gaemi must confirm the exact recipient naming,
  return routing, carrier, Jeju/island policy, and charges before that write.
- The supplier catalog now directly supports the notice claims `파우치`,
  `폴리에스테르`, manufacturer `KLAND`, and country `중국(OEM)`. The purchased
  option and warehouse record support black and `10.5 x 3.6 x 6.5 cm`.
- The supplier page exposes an unchanged-use permission and a product thumbnail,
  but the evidence still does not prove that one asset satisfies both WING main
  and detail-image requirements or that modification is allowed.
- WING seller-private information requires password reauthentication. No
  password was requested, read, stored, or typed by this task.

The exact root-cause classification is external configuration/facts, not
database or code. Do not add a code fallback for missing seller identity,
provider return authority, API credentials, or product compliance markings.

## Authenticated Gaemi B2C and return follow-up

The owner authorized informational external writing when account-native facts
were unavailable. The authenticated account established the following before
that request:

- KK946 supports `B2C 일반출고`, distinct from the separate Rocket Growth and
  milk-run B2B paths. A one-unit quantity can be prepared in the form, but no
  customer data was entered and no order was completed.
- The general outbound/return page identifies CJ Logistics as the normal return
  carrier. A non-CJ return requires advance information through the provider
  request box.
- The return form is bound to an existing outbound order and captures a return
  or exchange reason, requested disposition, optional evidence, and request
  details. No outbound order exists yet, so no return request was created.
- The public rate card remains a standard rate, not proof of the account's final
  VAT-inclusive debit. The authenticated pages do not expose the exact WING
  recipient label, account-applied outbound/return debit, or Jeju/island rule.

The categorized provider thread received a partial reply. Gaemi confirmed that
B2C general outbound and WING must use CJ Logistics, supplied private WING
outbound/return values that remain only in the provider system, and stated that
no extra company or order-code text is required in the return recipient label.
It also confirmed Jeju and island delivery with a `3,000-5,000 KRW` regional
surcharge, an order-bound return/exchange application under general order
information, and use of the general-outbound menu rather than the separate
Coupang/Rocket-Growth outbound menu.

The bounded follow-up received a final provider reply on 2026-08-13. Gaemi
cannot verify whether the private logistics values it supplied are accepted by
the current WING account because it cannot inspect that account. It also cannot
pre-confirm the packaging class or the VAT-inclusive final outbound and return
debits; those become observable only in the Gaemi point ledger after the
corresponding operation completes. The public account-visible rate card remains
planning evidence, not an exact debit promise.

For a customer return, the operator must first check in WING whether Coupang
has arranged pickup. If the item is sent back to Gaemi, the matching existing
order must then be opened under Gaemi general order information and submitted
as `return/exchange`. The reply still does not determine whether the pickup is
automatic or seller-entered in every case, and it supplies no additional
mandatory identifier beyond the order-bound application already observed.

Gaemi declined to prescribe WING initial-return and return fees. It repeated
that Jeju and island delivery is available with a regional surcharge in the
`3,000-5,000 KRW` range, but did not split that range into exact WING Jeju and
non-Jeju-island fields. These values therefore remain owner-entered WING policy
decisions, not provider-confirmed account charges. No further provider inquiry
is authorized or needed for this packet. This informational exchange does not
authorize any commerce or secret-configuration write.

## Exact offer plan

| Field | Bound value |
| --- | --- |
| Account | current owner WING account |
| Catalog/option | `9681483612` / black |
| Proposed seller product code | `KK946-BLACK` |
| Unit of sale | 1 |
| Maximum stock/orders | 6 / 6 |
| Normal price / sale price | `4,290 / 4,290 KRW` |
| Customer shipping | free (`0 KRW`) |
| Fulfillment | seller fulfilled through Gaemi only |
| Ads/coupons/automatic repricing | disabled / disabled / disabled |
| Reorder/Rocket Growth inbound | prohibited / prohibited |
| Exposure | maximum 14 days; no-sale review after 7 days |
| Actual attributable loss cap | `30,000 KRW` |

Using identical v3 cost assumptions, the existing estimate is `-1,548 KRW`
base and `-1,840 KRW` stress contribution per completed order. Six completed
orders therefore estimate `-9,288 KRW` base and `-11,040 KRW` stress, leaving
`18,960 KRW` below the loss cap under the stress estimate. The historical
`9,530 KRW` procurement/inbound cash is already allocated in those per-order
economics and must not be added a second time when measuring contribution loss.
Actual provider charges, returns, refunds, penalties, and settlement deductions
must still accumulate against the cap.

## Product information and unresolved evidence

Truthful facts currently available are model `KK946`, black, polyester,
warehouse-recorded `10.5 x 3.6 x 6.5 cm`, manufacturer claim `KLAND`, and
supplier origin claim China (OEM). The offer kind can be described as a
charger/cable storage mini pouch.

The offer must remain adult/general-use and must not be described or targeted as
a children's product. The current official safety sources apply the children's
product regime to products intended for children age 13 or younger, while
general household textile goods remain subject to their applicable safety and
marking standard. Therefore the WING default `인증·신고 대상 아님` is not by
itself evidence: importer responsibility and the physical product/packaging
marking still need verification.

These fields remain stop conditions rather than guessed form values:

1. Seller/importer identity and exact certification applicability.
2. Owner-approved handling precautions, quality-warranty wording, and private
   A/S responsible party/contact.
3. Product barcode behavior; a warehouse shipping label is not product-barcode
   evidence.
4. A rights-cleared main image and detail image. The supplier allows its detail
   image to be used unchanged for the exact product, but editing rights are
   unknown. A competitor image or synthetic look-alike image is prohibited.
5. An approved recoverable confidential asset store. Raw images, account data,
   addresses, contacts, or evidence must not be committed to Git.
6. Password-gated WING seller/A/S facts and the exact provider-authorized return
   routing. The operator must enter the password directly in WING; it must never
   be sent through chat or committed.
7. Automated fulfillment requires a separately approved Gaemi Coupang API
   connection. Vendor code, Access Key, and Secret Key are secrets/private
   configuration and must be entered only in the provider UI, never in Git or
   Codex output. Until connected, the experiment may use only the documented
   manual first-order fallback.

WING's current UI recommends a square main/additional image of at least 500 px
(`1000 x 1000` recommended), JPG/PNG and no more than 10 MB; it permits up to
nine additional images. The detail image recommendation is `780 x 5000`,
JPG/PNG, no more than 10 MB. If the API is later used, its current official
image contract must be checked separately because its file-size constraint is
different.

## Outbound and return completion gate

Creating either WING address record is a commerce-related external write. The
form requires a name, domestic/overseas type, postal address, private contact,
and Jeju/island availability. The return record also determines the operational
return route and charges. The account's representative-address default must not
be accepted silently.

Before execution, the owner must confirm WING accepts the private dispatch and
return values retained at Gaemi, choose the WING initial-return, return, Jeju,
and non-Jeju-island fee fields under Coupang policy, and accept that the exact
Gaemi debit is measurable only after the applicable operation. Gaemi confirmed
CJ Logistics and the order-bound return application, but did not guarantee a
fixed package, final debit, or universal automatic-pickup mode.

The shortest owner path is:

1. Reauthenticate WING only if the existing session expires; the password must
   be entered directly and never copied into chat or Git.
2. Review the provider-supplied private logistics values directly at Gaemi,
   verify WING accepts them, and choose the WING return/remote-area fee fields.
   Exact Gaemi outbound and return debits remain post-operation ledger evidence.
3. Choose whether this six-unit experiment may use manual Gaemi order entry or
   whether a separately approved secret-bearing Coupang API connection is a
   prerequisite. Product Registration approval does not silently authorize API
   credential configuration.

## Proposed execution sequence after exact approval

1. Re-read the WING final form and all private logistics inputs; stop on any
   mismatch or new fee.
2. Create the separately named Gaemi-authorized outbound and return records.
3. Register only catalog product `9681483612`, black, as `KK946-BLACK`, stock
   6, `4,290/4,290 KRW`, free shipping, ads/coupons/repricing off.
4. Verify the returned seller product/item identifiers, approval state, visible
   price, visible stock, shipping charge, and that no advertisement exists.
5. Monitor at least listing activation, one order, Gaemi shipment/tracking,
   customer completion, and Coupang settlement; measure every attributable
   charge against the cap.
6. At a stop event, pause exposure or set sellable stock to zero using the
   safest supported action. Do not cancel paid orders, delete evidence, or
   remove shared address records as an automatic rollback.

If an API is used, first-save intent should remain `requested=false` where the
current contract supports a save-without-approval-request mode. The WING UI may
have a different final-submit lifecycle, so its final confirmation behavior
must be reviewed at execution time.

## Approval boundary

The approval, when requested after code/CI/Preview gates, must bind all of the
following in one statement:

> 현재 공감라인 WING 계정에 개미창고가 승인한 출고지·반품지를 등록하고,
> Coupang product 9681483612 블랙에 KK946-BLACK, 재고 6, 정상가/판매가
> 4,290원, 무료배송, 광고·쿠폰·자동가격조정·재주문 없음, 손실상한
> 30,000원으로 등록 실행을 승인합니다. 등록 전 최종 요약이 다르면
> 중지합니다.

This statement is not yet an approval merely because it appears in this packet.
Until the owner sends it after reviewing the final blockers, all external
writes remain prohibited.

## Sources and durable state

- Coupang official Category Recommendation:
  <https://developers.coupangcorp.com/hc/ko/articles/360033509234>
- Coupang official category metadata:
  <https://developers.coupangcorp.com/hc/ko/articles/360034035713>
- Coupang official Product Creation API:
  <https://developers.coupang.com/ko/api/products/product-creation?ref=legacy>
- Gaemi public service description: <https://www.gemichango.com/>
- Gaemi terms: <https://www.gemichango.com/gemi_terms1.html>
- Gaemi public rate card:
  <https://www.gemichango.com/Gemichango_Logistics_cost_chart.pdf>
- Gaemi current member manual:
  <https://www.gemichango.com/%EA%B0%9C%EB%AF%B8%EC%B0%BD%EA%B3%A0_%EC%9D%B4%EC%9A%A9%EC%95%88%EB%82%B4%28%ED%9A%8C%EC%9B%90%EC%82%AC%29_%EB%A7%A4%EB%89%B4%EC%96%BCv1.3_25.01.pdf>
- Korea Product Safety general textile standard:
  <https://www.law.go.kr/LSW/admRulLsInfoP.do?admRulSeq=2100000237416>
- Korea children's product scope:
  <https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2100000184154>

GitHub owns only this sanitized decision packet, tests, PR, and CI evidence.
WING, Coupang, Domeggook, and Gaemi remain the authorities for private account,
transaction, address, contact, asset, tracking, return, and settlement data.
The unsaved browser form is temporary and is not a durable source of truth.
