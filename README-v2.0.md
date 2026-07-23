# 공감라인 AI v2.0

## 핵심 업그레이드
- 기존 도매꾹 수집·Supabase 저장·상품 검토 기능 유지
- `/competition` 쿠팡 판매 경쟁력 분석 화면 추가
- 가격, 검색 결과 수, 로켓 비율, 리뷰 장벽, 검색량, 마진을 합산한 100점 분석
- S/A/B/C/D 등급과 월 판매량·월매출 범위 계산
- 분석 결과를 `products` 테이블에 저장
- 분석 로직을 `features/competition`으로 분리하여 이후 데이터 자동수집 연동 가능

## 적용 순서
1. Supabase SQL Editor에서 `supabase/migrations/002_product_workflow.sql`이 미실행이면 먼저 실행
2. `supabase/migrations/003_coupang_competition_analysis.sql` 실행
3. 기존 `.env.local`을 새 프로젝트 루트에 복사
4. `npm install`
5. `npm run build`
6. `npm run dev`

## 중요
현재 v2.0 경쟁력 분석은 사용자가 확보한 쿠팡 시장 데이터를 입력하는 방식입니다. 임의 크롤링은 포함하지 않았습니다. 이후 공식·허용 데이터 공급원을 연결하면 동일 분석 엔진에 자동 입력할 수 있습니다.
