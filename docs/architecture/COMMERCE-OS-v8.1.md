# 공감라인 AI Commerce OS v8.1 아키텍처

## 목표
기존 Next.js 운영 화면과 API를 그대로 유지하면서 핵심 비즈니스 로직을 엔진 단위로 분리한다.

## 디렉터리 책임
- `app/`: 화면과 HTTP 라우팅만 담당
- `engines/`: 시장·추천·소싱·묶음·리스팅·쿠팡·3PL·학습 비즈니스 규칙
- `modules/`: 엔진을 조합한 업무 유스케이스
- `shared/`: 공통 계약, 도메인 타입, 인프라 추상화
- `packages/`: 설정 및 향후 독립 패키지
- `lib/`: 기존 호환 계층. 단계적으로 engines/shared로 이동

## 의존성 규칙
1. `app`은 `engines`와 `modules`를 호출한다.
2. 엔진은 다른 엔진의 공개 `index.ts`만 참조한다.
3. 엔진은 UI 컴포넌트를 참조하지 않는다.
4. Supabase, 외부 API는 shared/infra 또는 adapter 뒤에 둔다.
5. 기존 `lib`는 즉시 삭제하지 않고 compatibility layer로 유지한다.

## 다음 구현 순서
1. Supplier Intelligence DB 및 견적 입력/비교
2. 승인 추천을 sourcing case로 전환
3. Bundle 원가·포장·3PL 비용 계산
4. Listing AI 초안 생성
5. 쿠팡 등록 승인 흐름
6. 3PL 입고·재고·출고 adapter
7. 실판매 피드백 학습
