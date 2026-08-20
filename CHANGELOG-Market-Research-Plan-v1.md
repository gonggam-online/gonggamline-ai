# Market Research Plan v1

## 변경

- `shared/domain/market-research-plan.ts`에 공식 API, 승인된 유료 공급자,
  공개 메타데이터, 공개 영상 메타데이터, 공급자 카탈로그, 수동 입력을
  동일한 read-only 연구 태스크 계약으로 정규화했다.
- 각 태스크는 승인 여부, 정책 상태, cooldown, 설정 유무, 예상 비용과
  필요한 시장 신호를 함께 기록한다. 미승인 유료 소스는 호출하지 않고
  `APPROVAL_REQUIRED`로 남긴다.
- `shared/domain/market-research-packet.ts`가 현재 기회 분석과 다음 합법적
  데이터 확보 순서를 결합한다. 비용 증거가 부족한 후보는 버리지 않고
  `RESEARCH_NEXT`로 유지한다.

## 안전 경계

- 네트워크·스크래핑·유료 호출·Secret·DB 쓰기·커머스 쓰기를 수행하지 않는다.
- 운영 판정, 추천 순위, 가격, 구매, 입고, 상품등록을 변경하지 않는다.
- 실제 실행은 별도 승인된 executor/source policy와 Cloud durable evidence
  경계가 준비된 뒤에만 가능하다.
