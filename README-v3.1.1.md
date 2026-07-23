# 공감라인 AI v3.1.1

쿠팡 상품 등록 기능의 타입, 검증, 카테고리 메타 조회, 상품 생성 로직을 분리한 유지보수 업그레이드입니다.

## 신규 파일

- `types/coupang.ts`
- `lib/coupang/category.ts`
- `lib/coupang/register.ts`
- `lib/coupang/validator.ts`

## 수정 파일

- `app/api/coupang/categories/meta/route.ts`
- `app/api/coupang/register/route.ts`
- `lib/coupang/product-validation.ts` (호환용 재내보내기)

## 적용

기존 프로젝트에 위 파일만 같은 경로로 복사하고, 서버를 다시 시작합니다.
