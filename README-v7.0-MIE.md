# Gonggamline AI v7.0 — Market Data Warehouse & Feature Engine

## 핵심 추가
- 008 마이그레이션: Feature Snapshot, Feedback Event, 확장 점수 컬럼
- 가격/순위 변동성, 리뷰 속도, 데이터 완전성, 공급 안정성, 광고 부담, 진입 난이도
- 분석할 때마다 Feature Snapshot 보존
- 실제 판매/반품/광고/등록 피드백 이벤트 API
- Market Dashboard에 Data Warehouse 상태 및 다차원 점수 표시

## 적용
1. 기존 005~007 실행 여부 확인
2. `supabase/migrations/008_market_data_warehouse.sql` 실행
3. `npm install`
4. `npm run build`
5. `npm run dev`
6. `http://localhost:3000/market`

## 신규 API
- `GET /api/market/warehouse`
- `POST /api/market/feedback`
