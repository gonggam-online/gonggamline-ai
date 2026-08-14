# KK946 WING registration-ready packet v1

Observed and executed on 2026-08-14 KST. This is a sanitized recovery and
handoff record. WING retains the authenticated account, phone, address and
other private provider fields; none of those raw values are copied here.

## Decision and approval boundary

- Pipeline result: `REGISTRATION_READY`
- Selected revision/variant: `kk946-wing-registration-packet-v1` / `A`
- Content approval: `owner:kk946-content-approval:2026-08-14`
- Separate live-write approval: `owner:kk946-live-write-approval:2026-08-14`
- WING action completed: validated fields were written to the existing draft
  and persisted with `중간저장`.
- WING action deliberately not performed: final `상품등록` submission.
- Minimum registration gate: PASS. There are no blockers in any of the five
  owner-approved blocker classes.
- Conversion gate: `OPTIMIZATION_PENDING`; the selected minimum packet remains
  registration-ready.

## Exact selected customer content

- Title: `미니 파우치 충전기 케이블 수납 KK946`
- Keywords, in rank order:
  `충전기 파우치`, `케이블 파우치`, `소형 수납 파우치`, `투명 파우치`,
  `미니 파우치`, `충전기 케이블 수납`, `KK946`
- The exact WING preview initially warned when `블랙` appeared in both title and
  option. The exact adapter title policy was therefore rerun without the color
  token. The saved/reloaded final draft has no duplicate-option title warning.

Search filters:

| WING field | Exact value |
| --- | --- |
| 패션 의류/잡화 색상계열 | 블랙계열 |
| 패션 잡화 소재 | 폴리에스터 |
| 패션잡화 사이즈 | FREE |
| 파우치 종류 | 일반/다용도 |
| 구성 | 단품 |
| 수량 | 1 |
| 스타일 | 키체인 후크 |
| 잠금/고정방식 | 지퍼형 |
| 주머니 수 | 1 |
| 칸/분할 수 | 1 |
| 모델명/품번 | KK946 |

## Category, options, notices and commerce

- Exact display category code: `69291`
- WING internal category id: `2979`
- Path: `패션의류잡화 > 여성패션 > 여성잡화 > 가방 > 여성파우치`
- Notice category: `가방`
- Options: `색상=블랙`, `패션의류/잡화 사이즈=FREE`
- Price: original/sale `4,290 KRW`
- Stock: `6`; offer quantity `1`
- Shipping: seller fulfilled, `FREE`, same-day cutoff `12:00`, CJ Logistics
- Return fee: one-way `3,000 KRW`; customer-fault round trip `6,000 KRW`
- Advertising: disabled; reorder: disabled
- Provider references: outbound `25271547`, return center `1002681511`

Notice payload:

| Notice field | Exact public value |
| --- | --- |
| 종류 | 미니 수납 파우치 |
| 소재 | PVC, 폴리에스터 |
| 색상 | 블랙 |
| 크기 | 10.5 x 3.6 x 6.5 cm |
| 제조자(수입자) | KLAND / KLAND |
| 제조국 | 중국(OEM) |
| 취급시 주의사항 | 생산 시기에 따라 색상 차이가 있을 수 있으며, 배송 중 구김·제작 과정의 미세 스크래치와 자국이 발생할 수 있습니다. |
| 품질보증기준 | 제품 이상 시 공정거래위원회 고시 소비자분쟁해결기준에 의거 보상합니다. |
| A/S 책임자와 전화번호 | `공감라인 고객센터 / provider-retained:wing-company-contact` |

`제조자(수입자)` uses the recorded owner-approved combined-field fallback.
The private WING contact was present after saved-draft reload; its SHA-256 is
`1aaed20cf97e7053defa76dd4eff572fc1db1dcaa5fd57133be0cebee0b7427a`.
Private return zip/address/detail digests are respectively
`c1f12298fdc17085070d3a5f37883edcbeae3ea35ac10f1e481fa02535c9c8c0`,
`b8d4b43b3d5d58f4b2921eb1a1ce713db0a61638a3e579fffd0b8cc2334977e2`,
and `528c28af9e5dd16f4018f124fd491bd917f46f1c2c346a9b7780e158c07f1e0f`.

## Asset and rights result

Selected unchanged-use main asset:

- URL: `https://cdn1.domeggook.com/upload/item/2025/04/04/174375410405D99521FE1642D2F86834/174375410405D99521FE1642D2F86834_img_760?hash=fbbababcf3996b5a0feeeb9dc3556409`
- SHA-256: `d3ab260cef16fd5fc0485591b01fe0571d3d5f04b61832159b5029a2c4797bcf`
- JPEG, `760 x 760`, `126675` bytes
- `useRights=VERIFIED`, `editRights=UNKNOWN`, `transformation=NONE`
- Selected-payload rights, MIME, digest, load, crop, product accuracy, alt text,
  background and promotional-text checks: PASS

Excluded supplier detail source:

- URL: `https://images002.sabangnet.co.kr/v1/AUTH_63599845f0db471682fd9b55ff0c7ce9/image/1773042545001.jpg`
- SHA-256: `24c70d1f4b124093baa73c5e84210d1c209234e9e569a9756ac33f72de3f1449`
- Excluded because it mixes white and black variants and failed selected-SKU
  product-accuracy/height review. It is not in the WING detail payload.
- Edit-rights-unknown derivative requests are
  `DERIVATIVE_UNAVAILABLE` warnings only; no derivative was created or used.

## Rendered mobile detail package

Pipeline HTML SHA-256:
`6a9e8359128ec880123bdf96c6f6fcec516fd4db3858788f9894a151b688473d`.

```html
<article data-listing-packet="kk946-wing-registration-packet-v1" style="width:780px;max-width:100%;font-family:Arial,'Noto Sans KR',sans-serif;color:#171717;line-height:1.65"><h1 style="font-size:30px">미니 파우치 충전기 케이블 수납 KK946</h1><section data-block="IDENTITY" style="padding:24px 20px;border-bottom:1px solid #ddd"><h2 style="font-size:24px;margin:0 0 8px">상품</h2><p style="font-size:20px;margin:0">상품: 미니 파우치</p></section><section data-block="VERIFIED_BENEFIT" style="padding:24px 20px;border-bottom:1px solid #ddd"><h2 style="font-size:24px;margin:0 0 8px">수납 용도</h2><p style="font-size:20px;margin:0">수납 용도: 충전기 케이블 수납</p></section><section data-block="SPECIFICATION" style="padding:24px 20px;border-bottom:1px solid #ddd"><h2 style="font-size:24px;margin:0 0 8px">실제 크기</h2><p style="font-size:20px;margin:0">실제 크기: 10.5 × 3.6 × 6.5 cm</p></section><section data-block="SPECIFICATION" style="padding:24px 20px;border-bottom:1px solid #ddd"><h2 style="font-size:24px;margin:0 0 8px">색상</h2><p style="font-size:20px;margin:0">색상: 블랙</p></section><section data-block="SPECIFICATION" style="padding:24px 20px;border-bottom:1px solid #ddd"><h2 style="font-size:24px;margin:0 0 8px">소재</h2><p style="font-size:20px;margin:0">소재: PVC, 폴리에스터</p></section><section data-block="SPECIFICATION" style="padding:24px 20px;border-bottom:1px solid #ddd"><h2 style="font-size:24px;margin:0 0 8px">구성</h2><p style="font-size:20px;margin:0">구성: 1</p></section><section data-block="OBJECTION" style="padding:24px 20px;border-bottom:1px solid #ddd"><h2 style="font-size:24px;margin:0 0 8px">구매 전 확인</h2><p style="font-size:20px;margin:0">구매 전 확인: 생산 시기에 따라 색상 차이가 있을 수 있으며, 배송 중 구김·제작 과정의 미세 스크래치와 자국이 발생할 수 있습니다.</p></section><section data-block="FULFILLMENT" style="padding:24px 20px;border-bottom:1px solid #ddd"><h2 style="font-size:24px;margin:0 0 8px">배송</h2><p style="font-size:20px;margin:0">배송: 무료배송, 당일출고</p></section><section data-block="NOTICE" style="padding:24px 20px;border-bottom:1px solid #ddd"><h2 style="font-size:24px;margin:0 0 8px">제조자·수입자</h2><p style="font-size:20px;margin:0">제조자·수입자: KLAND / KLAND</p></section><section data-block="NOTICE" style="padding:24px 20px;border-bottom:1px solid #ddd"><h2 style="font-size:24px;margin:0 0 8px">제조국</h2><p style="font-size:20px;margin:0">제조국: 중국 OEM</p></section></article>
```

WING/TinyMCE safely normalizes the markup while preserving all ten verified
content blocks. The saved-and-reloaded WING-normalized HTML is `1287` bytes and
has SHA-256
`849bfa3d305e63a6e2cba7ce3195efec68a236f3f5c427943570690ddf6139d7`.
It contains no external image or script. The iframe read-back and WING mobile
preview passed encoding, readability, mobile width, content order, load,
count/color/material/components, claim and crop inspection.

## Remaining non-blocking optimization items

- Main image is above Coupang's minimum but below the official 1000x1000
  recommendation.
- No approved edit right exists, so cropped/background-removed/overlay/
  composite/generative-reference variants remain unavailable.
- No rights-and-accuracy-passing detail image is selected; the mobile package
  is intentionally text-led.
- No fresh same-category market observation or post-sale actual metrics exist;
  the packet remains a cold-start selection and must enter the append-only
  learning loop after traffic and profit/return data become sufficient.

## Production and WING verification

- Merged generic pipeline Production commit: `5cf73a75a3e35373aa7779a3b8f43cbdf05b7dcb`
- Production: `https://gonggamline-ai.vercel.app`
- Production browser run `31753329215`: 44 passed, 2 skipped; artifact
  `9201812470`, SHA-256
  `912d6aa79abc242542f10650c953caddc9ea54592bd7358bd1da77f8462c0148`.
- WING saved-draft reload confirmed the exact title, category, seven keywords,
  all eleven filters, nine notices, price, stock, free shipping, private contact
  presence, main asset and ten detail blocks.
- The final WING `상품등록` control remains untouched for the original task to
  perform after its own final human review.
