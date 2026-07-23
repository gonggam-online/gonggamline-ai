# v11.0 롤백

1. 애플리케이션 파일을 v10.2 전체 패키지로 복원합니다.
2. `.env.local`은 유지합니다.
3. 018에서 추가한 테이블은 향후 재적용을 위해 유지하는 것을 권장합니다.
4. 완전 삭제가 필요하면 데이터 백업 후 `ai_ceo_briefs`, `ai_memory_events`, `knowledge_assets`, `marketplace_connections`, `profit_snapshots`를 삭제합니다.
