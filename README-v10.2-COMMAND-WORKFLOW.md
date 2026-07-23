# Gonggamline AI v10.2.0
## Command Center + Workflow Automation

v10.1과 v10.2를 하나의 업데이트로 통합했습니다.

### 포함 기능
- AI Command Center 6개 실행 명령
- 명령 Queue 및 Worker 자동 배정
- Commerce Workflow Pipeline 시각화
- 오늘의 실시간 Activity KPI
- 확장 Diagnostics: Queue, Memory, Storage
- Worker 현재 작업·최근 활동·성능 표시
- Activity Stream 및 Command Queue
- v10.2 Release Manager 기록

### 적용
1. 기존 프로젝트와 `.env.local` 백업
2. 전체 패키지 사용 또는 패치 덮어쓰기
3. Supabase SQL Editor에서 `supabase/migrations/017_command_center_workflow_automation.sql` 실행
4. `npm install`
5. `npm run build`
6. `npm run dev`
7. `/os` 접속

### 안전 설계
Command Center 버튼은 실제 쿠팡 등록을 즉시 수행하지 않습니다. 명령을 Queue에 기록하고 Worker에 배정합니다. 실제 외부 실행은 기존 검증 및 승인 절차를 거칩니다.
