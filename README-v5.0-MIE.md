# 공감라인 AI v5.0 — Market Intelligence Engine

이 버전은 실제 v3.2 소스에 독립형 시장 데이터 수집·축적 엔진의 기반을 통합한 업데이트입니다.

## 포함 기능
- `/market` 시장 인텔리전스 대시보드
- 관찰 키워드 등록 및 수집 큐
- 시장 상품 정규화 저장
- 가격·리뷰·순위·광고·로켓·품절·배송·옵션 스냅샷
- Collector 실행/차단/쿨다운 기록 구조
- 가격 급변·리뷰 급증·순위 변동·품절/재입고 신호 구조
- 판매량 범위 추정 및 신뢰도 구조
- 실제 판매 결과를 통한 모델 피드백 구조
- 외부 Collector가 안전하게 관측치를 넣는 `POST /api/market/observe`

## 설치
1. 기존 DB 백업
2. `supabase/migrations/005_market_intelligence_engine.sql` 실행
3. `.env.local` 확인
4. `npm install`
5. `npm run build`
6. `npm run dev`
7. `/market` 접속

## 중요
이 패키지는 접근 제한 우회, CAPTCHA 우회, 프록시 순환, 비공개 API 역공학을 포함하지 않습니다. Collector는 공식 API와 공개 페이지의 허용된 범위만 사용하도록 별도 배포해야 합니다.
