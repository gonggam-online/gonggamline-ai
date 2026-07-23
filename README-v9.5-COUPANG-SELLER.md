# 공감라인 AI v9.5 — Coupang Seller Engine

## 목표
승인된 Listing Draft를 쿠팡 등록 Queue로 만들고, 검증·실등록·오류·재시도·결과를 Commerce Workflow에 연결합니다.

## 적용
1. Supabase SQL Editor에서 `supabase/migrations/014_coupang_seller_engine.sql` 실행
2. 기존 `.env.local` 복사
3. `npm install`
4. `npm run build`
5. `npm run dev`

## 화면
- `/seller`: 쿠팡 등록 운영센터
- `/coupang/register`: JSON 검증 및 실제 등록 워크벤치
- `/coupang`: 연결 및 등록상품 조회

## 안전 원칙
- 실제 등록은 확인 문구를 입력해야만 실행됩니다.
- Listing 승인 전에는 등록 Queue를 만들 수 없습니다.
- 기본 Validation 오류는 Queue에 보존됩니다.
- 실패 응답과 재시도 이력을 삭제하지 않습니다.
- 카테고리 고시·인증·옵션 정보는 실등록 전에 사람이 확인해야 합니다.
