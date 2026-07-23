# v10.2 Rollback

1. 현재 `.env.local` 보존
2. 애플리케이션 소스를 v10.0 전체 패키지로 복원
3. 필요 시 아래 테이블을 백업 후 삭제
   - `public.os_command_runs`
   - `public.os_notifications`
4. `system_releases`의 10.2.0 행을 `rolled_back`으로 변경

017 migration은 기존 테이블을 파괴하지 않는 additive migration입니다.
