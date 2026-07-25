# CHANGELOG · Sprint 2

## Added
- Worker Runtime Event 테이블
- Runtime Job claim/lock/heartbeat/result 필드
- Worker Registry
- Queue Executor API
- Retry/Cancel API
- Revenue Center 실행 제어 UI
- Decision/Memory 자동 기록
- 기존 Product 가격·비용·예상 판매량을 사용하는 순수 Revenue Calculation Engine
- `ready`, `estimated`, `incomplete`, `invalid` 계산 상태와 근거 DTO
- `GET /api/products?includeRevenueCalculation=true` opt-in 계산 응답
- Revenue 계산 경계값 및 Product 매핑 단위 테스트

## Changed
- 프로젝트 버전 `11.0.0-sprint.2`
- Revenue Dashboard Sprint 표기 갱신
- Revenue 계산 계약 문서화 (`docs/revenue-calculation.md`)

## Unchanged

- Supabase schema, migration, Production data
- Competition, Discovery, Workflow, Runtime 알고리즘
- 기본 `GET /api/products` 응답 계약
- ROI 정의와 Revenue Score

# Sprint 2 - Revenue Score Engine

## Added

- Pure, explainable `0..100` Revenue Score based on the existing Revenue
  Calculation result, search demand, competition, optional supply stability,
  and data quality.
- Explicit factor weights, normalization thresholds, confidence penalties,
  missing factors, assumptions, and score status.
- Opt-in `GET /api/products?includeRevenueScore=true` response enrichment.
- Revenue Score contract documentation and focused boundary, normalization,
  weighting, missing-data, and confidence tests.

## Unchanged

- Revenue Calculation formulas and API option.
- Database schema, migrations, stored Product data, Production, Runtime Queue,
  Workers, marketplace behavior, and public Product API responses by default.
- No LLM calls, AI recommendation prose, or DB persistence.

# Sprint 2-4 - Revenue Ranking Engine

## Added

- Reusable, deterministic Revenue Ranking domain service.
- Revenue-first ranking with competition, confidence, analysis freshness,
  completeness, and data quality.
- Machine-readable reason codes, recommendation levels, and ranking-factor
  evidence.
- Opt-in `GET /api/products?includeRanking=true` top-level ranking DTO.
- 31 focused tests covering ties, confidence, invalid/incomplete states,
  freshness, explanations, recommendation levels, and stable ordering.

## Unchanged

- Revenue Calculation and Revenue Score formulas.
- Default Product API response and existing opt-in fields.
- Database schema, migrations, Production data, Runtime Queue, Workers,
  marketplace writes, Dashboard, and upload queue.
- No LLM/OpenAI calls, recommendation prose, or ranking persistence.

## Release validation

- Added deterministic Product API contract assertions for the default,
  Revenue Score, Revenue Ranking, and combined opt-in responses.
- Confirmed that opt-in fields are additive and existing response fields remain
  unchanged without depending on Preview data availability.
