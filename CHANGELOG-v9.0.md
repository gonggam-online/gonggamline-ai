# v9.0 Commerce Workflow Integration

## 핵심 변경
- 모든 상품 흐름에 고유 `workflow_code` 부여
- 중앙 상태 머신과 순차 전환 검증
- Discovery 승인, 소싱 승인, 발주, 3PL 계획, Listing 생성/승인 이벤트 자동 연결
- 연결 데이터 기준 전체 Workflow 자동 동기화(reconcile)
- 단계별 다음 업무 자동 생성
- 전환 이력, Timeline, Outbox 이벤트 분리 저장
- `/workflow` 통합 운영센터와 API 추가

## 신규 마이그레이션
`supabase/migrations/013_commerce_workflow_integration.sql`

## 신규 API
- `GET /api/workflows`
- `GET /api/workflows/{id}`
- `POST /api/workflows/reconcile`
- `POST /api/workflows/transition`
