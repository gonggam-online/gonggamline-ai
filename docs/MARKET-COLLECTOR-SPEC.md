# Market Collector 표준

모든 수집기는 다음 계약을 지켜야 합니다.

## 우선순위
1. 공식 API
2. 공개 데이터셋·공공 API
3. 공개 페이지의 저빈도 관찰
4. 관리자 수동 입력/CSV
5. 내부 주문·광고·반품 데이터

## 필수 안전장치
- 키워드/상품별 최소 수집 간격 60분
- 403, 429, CAPTCHA 감지 시 즉시 중단
- 지수 백오프가 아닌 장시간 cooldown 및 관리자 확인
- robots 및 약관 검토 상태 기록
- 요청 중복 제거와 캐시
- 원본 payload, 수집 시각, 출처 저장
- 개인정보·로그인 전용 데이터 저장 금지

## 표준 입력 API
`POST /api/market/observe`

```json
{
  "source": "coupang_public",
  "keyword": "무선청소기",
  "product": {
    "externalProductId": "123456789",
    "title": "상품명",
    "url": "공개 상품 URL"
  },
  "snapshot": {
    "rank": 3,
    "price": 59900,
    "rating": 4.7,
    "reviewCount": 1280,
    "rocketType": "rocket",
    "isSoldOut": false
  }
}
```
