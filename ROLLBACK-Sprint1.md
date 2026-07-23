# Rollback · Sprint 1

## 애플리케이션 롤백
1. 배포 전 v11.0 백업을 복원합니다.
2. 또는 아래 신규 경로를 제거하고 수정 파일을 v11.0으로 되돌립니다.
   - `app/revenue/`
   - `app/api/revenue/`
   - `services/revenue-core.service.ts`
   - `types/revenue.ts`
   - `app/globals.css`의 Sprint 1 블록
   - `app/os/page.tsx`의 Revenue Center 링크

## 데이터베이스 롤백
데이터 보존이 우선이면 테이블을 유지하십시오. 완전 제거가 필요한 경우에만 실행합니다.

```sql
drop table if exists public.revenue_decisions cascade;
drop table if exists public.runtime_jobs cascade;
drop table if exists public.revenue_opportunities cascade;
delete from public.system_releases where version='11.0.0-sprint.1';
```
