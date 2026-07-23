# Gonggamline AI v8.4

## 적용 순서
1. 기존 `.env.local` 복사
2. Supabase SQL Editor에서 `supabase/migrations/012_product_workspace_listing_ai.sql` 실행
3. `npm install`
4. `npm run build`
5. `npm run dev`

## 화면
- `/workspace`: 상품 생애주기 통합 Workspace
- `/listing`: Listing AI 초안 제작센터
- `/procurement`: 국내 조달·발주·3PL 준비센터

## 주의
Listing Engine은 현재 안정적인 내부 규칙 기반 초안을 생성합니다. 상품 인증, 고시정보, 상표권, 이미지 권리 및 사실관계는 최종 쿠팡 등록 전 사람이 검토해야 합니다.
