# Rollback · Sprint 2

1. 애플리케이션 코드를 Sprint 1 소스로 복원합니다.
2. 데이터 보존이 필요하면 DB 구조는 유지합니다.
3. 완전 제거 시 아래 SQL을 검토 후 실행합니다.

```sql
drop table if exists public.worker_runtime_events;
alter table public.runtime_jobs
  drop column if exists locked_by,
  drop column if exists locked_at,
  drop column if exists last_heartbeat_at,
  drop column if exists duration_ms,
  drop column if exists result_summary;
delete from public.system_releases where version = '11.0.0-sprint.2';
```
