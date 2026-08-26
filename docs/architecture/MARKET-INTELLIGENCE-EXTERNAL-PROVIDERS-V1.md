# Market Intelligence External Providers v1

## 승인 범위

이 Story는 아이템선정의 read-only 시장근거 수집을 위한 세 공급자 어댑터를
추가한다. 수집 결과는 기존 시장 관측/Shadow 흐름으로만 들어가며 운영
판정·추천 순위·가격·구매·입고·상품등록·Production을 변경하지 않는다.

| Provider | 용도 | 인증 | 비용/쿼터 경계 |
|---|---|---|---|
| NAVER API HUB 검색어 트렌드 | 통합검색 상대 검색 추이 | `NAVER_API_HUB_CLIENT_ID`, `NAVER_API_HUB_CLIENT_SECRET` | 애플리케이션별 승인 API와 콘솔 쿼터 적용 |
| NAVER API HUB 쇼핑 인사이트 | 명시한 쇼핑 분야의 키워드별 상대 클릭 추이 | 위 API HUB 키 + `NAVER_API_HUB_SHOPPING_CATEGORY_ID` | 카테고리를 추측하지 않으며 미설정 시 이 호출만 생략 |
| YouTube Data API | 공개 영상 제목·게시시점·검색순위 연구 | `YOUTUBE_DATA_API_KEY` | `search.list` 1회 100 quota units, 기본 일일 10,000 units; 영상/자산 권리 없음 |
| DataForSEO Naver Organic SERP | Naver SERP 경쟁·순위 보강 | `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` | pay-as-you-go; 요청당 `DATAFORSEO_MAX_COST_USD_PER_REQUEST` 필수 |

## 런타임

- Vercel 서버 런타임의 Secret 환경변수만 읽는다. 클라이언트·Git·Preview
  출력·로그에 credential을 내보내지 않는다.
- `MARKET_EXTERNAL_PROVIDER_ENABLED=true`가 없으면 native provider 실행은
  중단된다. 기존 configured HTTPS endpoint 경로는 그대로 유지된다.
- NAVER API HUB는 최근 30일의 일간 상대 추이를 수집한다. 2026-08-01
  종료된 Naver Developers Shopping Search API의 상품·가격 결과와 API HUB
  DataLab 추이는 서로 다른 계약이다. 따라서 API HUB 결과는 discovery
  signal로만 저장하고 상품·판매자·가격 행을 만들지 않는다.
- DataForSEO Naver는 depth 15, YouTube는 10건으로 제한한다. YouTube 결과는 `REFERENCE_ONLY/UNKNOWN` discovery signal로만
  반환하며 시장 snapshot에 리뷰 수나 자산 권리를 위조해 저장하지 않는다.
- 403/429/잘못된 JSON/인증 누락/비용 ceiling 초과는 fail-closed다.
- DataForSEO 호출은 depth를 고정하고 응답 비용이 configured ceiling을
  넘으면 결과를 거부한다. 공급자 계정의 예치금·일일 예산은 별도로
  공급자 콘솔에서 설정해야 한다.

## Secret 보관·복구

Secret의 authoritative owner는 Vercel Production Environment다. 값은
GitHub, Supabase 데이터, 로컬 파일, 테스트 fixture에 저장하지 않는다.
복구는 Vercel Secret 재주입과 동일 provider 계정의 quota/예산 설정 확인으로
수행한다. 키가 없으면 코드가 임의 endpoint나 synthetic fallback으로
대체하지 않는다.

## 약관·권리

공식 API 이용약관·quota를 준수한다. YouTube 메타데이터는 연구용이며 영상
바이트·썸네일·자막을 저장하거나 상품 이미지/생성 입력으로 사용하지 않는다.
DataForSEO는 검색 결과만 수집하고 원본 SERP HTML이나 로그인 세션을 직접
스크래핑하지 않는다. Naver/YouTube/DataForSEO의 최신 약관 변경 시 해당
source policy를 갱신하고 다시 승인한다.

## Rollout / rollback

1. Vercel Production에 API HUB Client ID/Secret을 저장한다. 전환 기간에는
   기존 `NAVER_CLIENT_ID`/`NAVER_CLIENT_SECRET`도 fallback으로 읽지만 신규
   이름을 권장한다. 값은 원문 그대로 저장하며 Base64 변환하지 않는다.
2. 쇼핑 인사이트가 필요하면 검증한 Naver Shopping `cat_id`만
   `NAVER_API_HUB_SHOPPING_CATEGORY_ID`에 지정한다.
3. `MARKET_EXTERNAL_PROVIDER`를 `naver_api_hub`로 선택하고
   `MARKET_EXTERNAL_PROVIDER_ENABLED=true` 설정
4. read-only smoke로 1개 keyword, 1회 호출 확인
5. 수집 결과를 Shadow/benchmark에서 검토
6. 운영 verdict 연결은 별도 Architecture/수동승인

중단은 enabled 플래그를 제거하고 provider key를 rotate하는 것으로
수행한다. 기존 market evidence와 Item Selection verdict는 유지한다.
