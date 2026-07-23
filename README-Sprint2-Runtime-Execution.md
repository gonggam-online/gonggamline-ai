# Sprint 2 · Runtime Execution

Blueprint v2.0의 Queue → Worker → Decision → Memory 실행 루프를 실제 동작 코드로 구현합니다.

## 핵심 기능
- 우선순위 기반 Runtime Job 선점
- Worker Registry 기반 Job 실행
- 성공/실패/재시도/취소 상태 관리
- Opportunity 자동 업데이트
- Revenue Decision 및 AI Memory 자동 기록
- Revenue Center에서 1건/최대 5건 실행

## 적용 순서
1. Sprint 1이 반영된 프로젝트에 이 Update Pack을 덮어씁니다.
2. Supabase SQL Editor에서 `020_sprint2_runtime_execution.sql`을 실행합니다.
3. `npm install`
4. `npm run build`
5. `/revenue`에서 `다음 Job 실행`을 클릭합니다.
