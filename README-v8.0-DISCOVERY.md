# Gonggamline AI v8.0 — AI Product Discovery + Bundle Intelligence

## 목적
시장 Feature Warehouse의 분석 결과를 실제 판매 검토 후보로 변환합니다.

## 신규 기능
- 단일상품 AI 점수: 시장·성장·경쟁·위험·수익·신뢰도
- 세트/묶음상품 자동 조합
- 조합 시너지·편의성·차별화·마진 점수
- 승인/거절/소싱 단계 상태 관리
- `/discovery` 운영 화면

## 적용
1. `supabase/migrations/009_ai_product_bundle_discovery.sql` 실행
2. `npm install`
3. `npm run build`
4. `npm run dev`
5. `http://localhost:3000/discovery`

## 주의
v8.0은 추천과 승인 대기열까지 구현합니다. 실제 공급처 견적, 3PL 입고 요청, 쿠팡 최종 등록 자동화는 다음 단계의 Supplier/Fulfillment 모듈에서 연결합니다.
