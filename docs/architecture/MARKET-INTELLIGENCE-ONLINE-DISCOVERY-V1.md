# Market Intelligence Online Discovery v1

## 목적

공개 온라인 정보, 공식 API, 공개 데이터셋, 공개 쇼핑·영상 메타데이터를 아이템선정의 사실·키워드·경쟁패턴 연구에 사용하되, 접근권한·저작권·약관·개인정보·커머스 실행을 우회하지 않는다.

## 허용된 정보 우선순위

1. 공식 API 또는 공식 공개 데이터셋
2. 공개 페이지의 저빈도 메타데이터 관찰
3. 공개 영상/쇼츠의 제목·조회·반응·게시 시점 등 메타데이터
4. 관리자 수동 입력 또는 CSV
5. 실제 판매·반품·정산 데이터

시장성 후보는 단순히 모든 hard gate를 한 번에 통과해야만 살아남는 구조로
만들지 않는다. `shared/domain/market-opportunity-analysis.ts`는 복수 출처의
수요·성장·경쟁·공급·콘텐츠 반응 신호를 신선도와 출처 가중치로 통합하고,
단위경제가 완성된 후보는 `ACTIONABLE`, 시장성이 높지만 비용 증거가 덜 된
후보는 `COST_CONFIRMATION_REQUIRED`로 분리한다. 후자는 시장성이 없어서 버리는
것이 아니라 실제 접촉 가능한 공급 상품의 비용 확인 대상으로 유지한다.

Google Trends API와 YouTube Data API의 사용 가능성은 공식 문서와 할당량을 확인해야 하며, API 키·OAuth·비용·약관은 별도 환경/Architecture 게이트로 유지한다. 공식 YouTube 검색 API는 검색 결과의 메타데이터를 반환하지만, API 결과가 상품 이미지·영상의 상업적 사용권을 의미하지 않는다.

## 구현된 안전 계약

`shared/domain/market-discovery-evidence.ts`의 순수 admission 함수는 다음을 검증한다.

- 출처·정책 버전·수집 방식의 일치
- robots/약관 검토 여부
- 로그인·CAPTCHA·anti-bot 우회 여부
- 최소 수집 간격 60초 이상
- HTTPS 출처와 관측 시각
- 가격·순위·리뷰·인기도·참여율의 범위
- 자산 권리와 사실/키워드 연구의 분리

실패한 신호는 `QUARANTINED`이며 엔진 점수·추천으로 승격할 수 없다. `REFERENCE_ONLY`와 `UNKNOWN` 자산은 상품 사실·키워드·고객질문·경쟁패턴 연구에는 사용할 수 있지만, 이미지 다운로드·복제·편집·생성 입력·상품등록에는 사용할 수 없다.

## 데이터 수집 운영 원칙

- 브라우저 위장, 헤더/쿠키 회전, CAPTCHA 우회, 로그인 세션 재사용, robots/약관 위반을 금지한다.
- 403/429/anti-bot은 즉시 중단하고 장시간 cooldown과 관리자 확인으로 전환한다.
- 원본 페이지·이미지·영상 바이트를 저장하지 않고 최소 메타데이터·URL·관측 시각·출처 식별자만 보관한다.
- durable evidence는 승인된 Supabase/암호화 Cloud 경계에만 저장한다. 로컬 파일이나 GitHub에 원본 사업데이터를 보관하지 않는다.
- 수집 신호는 기존 Item Selection 운영 verdict를 자동 변경하지 않는다. benchmark와 shadow review에서 먼저 평가한다.

## 다음 구현 순서

1. 공식 API별 승인된 source policy와 quota/cost packet 확정
2. 공개 메타데이터 adapter를 existing Market Collector에 연결
3. keyword/product/title/customer-question 신호 정규화 및 freshness/conflict 평가
4. 동일 후보군의 엔진·LLM·단순 기준선 비교
5. 실제 판매·반품·정산 라벨이 쌓인 뒤에만 calibration과 운영 기준 변경을 별도 검토

이 문서와 계약은 데이터 수집·DB 저장·외부 API·Queue·Production·커머스 쓰기 권한을 자체로 부여하지 않는다.

## 지속 학습과 실시간 적용

`shared/domain/market-research-plan.ts`와
`shared/domain/market-research-packet.ts`는 위 source lane을 후보별 다음
연구 태스크로 정렬한다. 공식·공개·공급자·유료 소스를 같은 계약으로 다루되,
승인되지 않은 유료 소스와 설정되지 않은 endpoint는 호출하지 않고 정확한
승인/설정 blocker로 남긴다. 시장성이 있지만 수익성·물류 증거가 덜 완성된
후보는 `RESEARCH_NEXT` 패킷으로 유지하여 높은 기준 때문에 후보군이 공집합이
되는 것을 방지한다. 이 패킷은 운영 verdict나 추천 순위를 바꾸지 않는다.

`shared/domain/market-learning-loop.ts`는 benchmark, 공개 관측, 판매 피드백,
운영자 검토에서 얻은 lesson을 증거 digest·정책 버전·관측 시각과 함께
결정론적으로 통합한다. `SHADOW` packet은 즉시 shadow review와 benchmark에
반영할 수 있지만 운영 verdict를 바꾸지 않는다. `APPROVED_OPERATIONAL`도
각 lesson의 승인 digest, 충돌 없음, freshness와 적용 범위 확인이 모두 있어야
적용 대상으로 표시된다.

따라서 기존 규칙·스킬·구현과 조화되지 않는 lesson은 충돌로 남고 자동 적용되지
않는다. 실시간 적용은 안전한 shadow 지식과 검토 화면에 우선 적용하며, 점수·추천
순위·수익성·커머스 실행 기준을 바꾸는 것은 별도 정책 버전과 수동 승인 대상이다.
## 판매 데이터 전 단계 운영 모드

실판매·반품·정산 데이터가 없는 동안에는 `presales-opportunity-ranking`과
`buildPresalesMarketResearchPacket`을 사용한다. 이 모드는 공식·유료·공개
메타데이터의 시장 점수, 출처 다양성, 신선도, 증거 커버리지, 불확실성 범위를
계산해 `PRIORITY_RESEARCH`, `VALIDATE_ECONOMICS`, `WATCH`, `BLOCKED`로
분류한다. 단위경제가 미완성이라는 이유만으로 강한 시장 후보를 삭제하지
않으며, 권리 실패와 확인된 음의 마진만 차단한다.

이 결과는 후보 연구 순서와 단일·세트·묶음 검토를 위한 것이며, 기존 운영
판정·추천 순위·구매·입고·상품등록·Production 결정을 자동으로 변경하지
않는다. 판매 데이터가 축적된 뒤에는 동일 후보 집합에 대해 benchmark의
precision/recall/NDCG와 실제 마진 오차를 계산해 이 사전평가 모드의 보정
여부를 검증한다.
