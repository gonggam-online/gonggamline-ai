# Revenue Opportunity Engine - Product Data Readiness Report

## 결론

`products`에는 Revenue Opportunity의 1차 후보 계산에 필요한 가격, 원가,
수수료, 광고비, 물류비, 예상이익, 마진율, 예상 판매량, 검색량, 경쟁강도가
이미 존재한다. `/api/products`도 현재 `products.*`를 반환하므로 별도 API
확장은 필요하지 않다.

그러나 아래 항목 때문에 이 데이터를 곧바로 신뢰 가능한 Revenue Opportunity
계산 입력으로 사용해서는 안 된다.

- 저장소에 `products` 최초 생성 migration이 없어 기존 핵심 컬럼의 DB 타입,
  기본값, nullable 여부를 코드만으로 확정할 수 없다.
- 카테고리와 브랜드는 `market_products`에는 있지만 `products`에는 확인되지
  않았고, 공급처는 별도 조달 테이블에 있으나 `products`와 직접 연결되지 않는다.
- ROI 컬럼과 합의된 ROI 정의가 없다.
- `products`의 수수료, 광고비, 물류비는 수집 시 설정값으로 계산되며 실제
  집행액 또는 견적의 출처·시점·신뢰도를 담지 않는다.
- 시장규모는 직접 측정 컬럼이 아니라 검색결과 수, 검색량, 예상 판매량 등의
  대리지표로만 존재한다.

따라서 이번 작업에서는 migration, API, TypeScript 계약을 변경하지 않는다.
실제 Supabase 스키마와 데이터 완성도 분포를 읽기 전 새 컬럼을 추가하면
중복·의미 충돌·Preview 장애 위험이 있다.

## 조사 범위와 근거

- Product 저장 계약: `services/product-storage.service.ts`
- Product 조회 API: `app/api/products/route.ts`,
  `services/products.service.ts`
- Product 수정 API: `app/api/products/[id]/route.ts`
- Competition API: `app/api/products/[id]/competition/route.ts`,
  `app/api/competition/analyze-batch/route.ts`
- Competition schema: migrations `003`, `004`
- Market Intelligence schema: migrations `005`, `006`, `008`
- Supplier schema: migration `010`
- Revenue Opportunity schema: migration `019`

## Revenue 계산 필드 준비도

| 계산 항목 | 현재 있음 | 부족 | 추가 필요 | 불필요 |
|---|---|---|---|---|
| 상품명 | `products.title` | nullable 계약을 저장소에서 확인 불가 | 실제 DB schema 확인 | 새 컬럼 |
| 상품 식별자 | `id`, `product_no` | 최초 DDL 부재 | 실제 DB unique/nullability 확인 | 새 식별자 |
| 판매가격 | `estimated_sale_price`, `manual_sale_price` | 값의 출처·기준시점 | provenance 계약 | 새 판매가 컬럼 |
| 원가 | `supply_price` | landed cost와 구분 필요 | supplier quote 연결 후 의미 확정 | 중복 원가 컬럼 |
| 수수료 | `marketplace_fee` | 수수료율/마켓/산정 버전 | assumption metadata | 계산 로직 변경 |
| 배송비 | `logistics_cost`; 조달에는 국내·국제·3PL 비용 존재 | product 값과 조달 상세비용 연결 없음 | 선택 견적 연결 | 단일 신규 배송비 컬럼 |
| 광고비 | `advertising_cost`; 실제값은 `market_model_feedback.actual_ad_spend` | 예상값과 실제값 구분·기간 | provenance 및 기간 계약 | 새 AI 추정 |
| 예상 이익 | `estimated_profit` | 계산 버전·근거 | assumption metadata | 중복 이익 컬럼 |
| 마진율 | `margin_rate` | 계산 버전·근거 | assumption metadata | 계산식 변경 |
| 예상 판매량 | `estimated_monthly_units_low/high`; market metrics/estimates에는 low/base/high | `products`에는 base 값과 신뢰도 없음 | source/confidence 연결 | 새 추천 알고리즘 |
| ROI | 없음 | 분모와 기간 정의 없음 | 사업 정의 승인 후 파생 지표로 설계 | 정의 없는 DB 컬럼 |
| 시장규모 | `coupang_result_count`, `coupang_keyword_search_volume`, `market_keywords.result_count` 대리지표 | 직접 시장규모 및 측정시점 없음 | 대리지표 계약·수집시점 | 임의 시장규모 추정 |
| 경쟁강도 | `competition_score`, grade/status/source/confidence | 미분석·추정 상태가 섞임 | 상태별 사용 가능성 규칙 | 알고리즘 변경 |
| 검색량 | `coupang_keyword_search_volume` | nullable이며 측정시점/출처 정밀도 부족 | provenance/freshness 계약 | 새 검색 알고리즘 |
| 카테고리 | `market_products.category` | `products`에서 확인되지 않음 | product-market mapping 확정 후 연결 | 추측 기반 문자열 복사 |
| 브랜드 | `market_products.brand` | `products`에서 확인되지 않음 | product-market mapping 확정 후 연결 | 추측 기반 문자열 복사 |
| 공급처 | `seller_id/name`; 별도 `suppliers`, `supplier_quotes` 존재 | 판매자와 공급처 의미가 다르고 직접 FK 없음 | 승인된 quote/mapping 연결 | seller를 supplier로 간주 |
| 썸네일 | `products.thumbnail`, `market_products.thumbnail_url` | Revenue 계산에는 비필수 | 없음 | Revenue 계산 입력 |

## DB nullable/기본값 확인 결과

저장소 migration으로 확정 가능한 `products` 후속 컬럼은 다음과 같다.

| 필드군 | nullable 상태 |
|---|---|
| competition score/grade/status/source/confidence | `NOT NULL`, 기본값 존재 |
| competition summary/note/analyzed_at | nullable |
| 쿠팡 가격·결과수·리뷰·평점·검색량 | nullable |
| 예상 월 판매량 low/high 및 예상 월 매출 low/high | nullable |

`supply_price`, `estimated_sale_price`, `marketplace_fee`,
`advertising_cost`, `logistics_cost`, `estimated_profit`, `margin_rate`,
`title`, `thumbnail`, `seller_id/name`의 최초 DDL은 저장소에 없으므로
nullable 여부를 확정하지 않는다. 애플리케이션은 숫자 필드에서 null을 `0`으로
보정하는 경로가 있어, API 샘플만으로 DB nullability를 추론해서도 안 된다.

## API 준비도

| API | 현재 반환/동작 | Revenue 준비도 | 이번 변경 |
|---|---|---|---|
| `GET /api/products` | pagination과 `products.*` | 현재 저장된 Revenue/Competition 필드를 반환 | 없음 |
| `PATCH /api/products/:id` | 수동 판매가와 파생 수익 필드 갱신 | 쓰기 API이며 readiness 조회용이 아님 | 없음 |
| `POST /api/products/:id/competition` | 입력 시장지표로 분석 후 갱신된 product와 analysis 반환 | 계산 입력 확보 가능, 단 mutation임 | 없음 |
| `POST /api/products/:id/competition/auto` | 자동 경쟁분석 실행 | 기존 알고리즘 경계 | 없음 |
| `POST /api/competition/analyze-batch` | pending/needs_data 상품 일괄 분석 | 기존 workflow/알고리즘 경계 | 없음 |

`GET /api/competition` 읽기 API는 없다. Competition 결과가 `products`에
저장되고 `GET /api/products`에서 반환되므로 이번 범위에서 새 endpoint를
추가하지 않는다.

## 위험 분류

이번 변경은 조사 보고서와 운영 상태 문서만 추가하는 **normal-risk** 작업이다.
DB, API 계약, 가격/마진 계산, Competition/AI/Workflow/Runtime을 변경하지
않는다. Production 데이터 쓰기와 migration 적용도 없다.

## 다음 Sprint 진입 조건

1. Supabase Dashboard의 Table Editor 또는 read-only SQL로 실제
   `products` 컬럼 타입, default, nullable, constraint를 내보낸다.
2. 각 필드의 null/0/음수/최신성 분포를 Production과 Preview에서 읽기 전용으로
   측정한다. 값이나 비밀키는 저장소에 기록하지 않는다.
3. ROI를 `(공헌이익 / 광고비)`, `(공헌이익 / 투입원가)` 등 어떤 의미로
   사용할지 사업 담당자가 승인한다.
4. `products`와 `market_products`, 승인된 `supplier_quotes` 사이의
   authoritative mapping을 정한다.
5. 위 결과로 부족함이 입증될 때만 별도 high-risk migration PR을 만든다.
6. 그 다음 PR에서 명시적 read DTO와 data readiness 상태
   (`ready`, `incomplete`, `stale`, `estimated`)를 추가한다.
