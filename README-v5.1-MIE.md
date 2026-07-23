# 공감라인 AI v5.1 — Market Intelligence Analytics

## 추가 기능
- 시장 스냅샷 기반 분석 엔진
- 가격/리뷰/순위/품절 변화 신호
- 월 판매량 범위 및 신뢰도 추정
- 상품별 기회점수와 S~D 추천등급
- 전체 분석 실행 API
- 상품 랭킹/시계열 조회 API
- 실제 수집기 연결 전 파이프라인 검증용 DEMO 데이터

## 적용 순서
1. 기존 005 migration 적용 확인
2. `supabase/migrations/006_market_intelligence_analytics.sql` 실행
3. `npm install`
4. `npm run build`
5. `npm run dev`
6. `http://localhost:3000/market` 접속

## API
- `POST /api/market/observe` 관측 저장 (`analyzeImmediately: true` 선택 가능)
- `POST /api/market/analyze` 전체 또는 단일 상품 분석
- `GET /api/market/products` AI 시장 상품 랭킹
- `GET /api/market/products/{id}/timeline` 상품 시계열
- `POST /api/market/demo-seed` DEMO 파이프라인 검증

> DEMO 데이터는 실제 시장 데이터가 아니며, UI/DB/분석 파이프라인 검증 용도입니다.
