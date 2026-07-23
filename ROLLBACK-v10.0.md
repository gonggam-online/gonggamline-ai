# v10.0 Rollback

1. 현재 `.env.local`을 백업합니다.
2. 애플리케이션 파일을 `gonggamline-ai-v9.6-ai-decision-engine` 패키지로 되돌립니다.
3. `npm install && npm run build`를 실행합니다.
4. 016 migration이 만든 테이블과 컬럼은 기본적으로 삭제하지 않습니다. 이전 버전에서 참조하지 않으므로 안전하게 유지할 수 있습니다.
5. 완전 제거가 필요한 경우 데이터 백업 후 `ai_workers`, `system_releases`, `system_health_checks`, `revenue_snapshots`를 수동 삭제합니다.
