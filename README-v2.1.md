# 공감라인 AI v2.1

## 핵심 변경
- 상품별 자동 경쟁력 분석 API
- 미분석 상품 10개 일괄 분석
- 외부 시장 데이터 공급원 어댑터
- 실데이터/수동입력/추정치 출처 표시
- 분석 신뢰도와 데이터 주석 저장
- 경쟁력 분석 화면 UI 개선

## 중요한 데이터 원칙
`COUPANG_MARKET_DATA_ENDPOINT`가 설정되지 않으면 자동 분석은 내부 추정 모드로 동작합니다. 이 결과는 실제 쿠팡 검색 데이터가 아니며 화면과 DB에 `estimated` 및 낮은 신뢰도로 명확히 표시됩니다.

외부의 합법적 시장 데이터 공급원을 사용하는 경우 `.env.local`에 아래 값을 추가합니다.

```env
COUPANG_MARKET_DATA_ENDPOINT=https://your-provider.example/api/market-data
COUPANG_MARKET_DATA_API_KEY=your-secret-key
```

공급원은 POST 요청을 받고 다음 숫자 필드를 JSON으로 반환해야 합니다.
`marketPrice`, `top10AveragePrice`, `resultCount`, `rocketRatio`, `averageReviewCount`, `averageRating`, `monthlySearchVolume`.

## 적용 순서
1. Supabase SQL Editor에서 기존 003 이후 `supabase/migrations/004_automatic_competition_pipeline.sql` 실행
2. 기존 `.env.local`을 새 프로젝트 루트에 복사
3. `npm install`
4. `npm run build`
5. `npm run dev`
