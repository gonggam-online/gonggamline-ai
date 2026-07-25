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
