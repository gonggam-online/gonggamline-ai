# Gonggamline AI v10.0 · AI Company OS Foundation

## 목적
v9.6의 AI Decision Engine을 기반으로 전체 기능을 한 회사처럼 관찰하고 통제하는 OS 계층을 추가합니다.

## 설치
1. 기존 v9.6 프로젝트를 백업합니다.
2. 이 패키지로 프로젝트 파일을 교체합니다.
3. `.env.local`의 Supabase 환경변수를 유지합니다.
4. Supabase SQL Editor에서 `supabase/migrations/016_ai_company_os_foundation.sql`을 실행합니다.
5. `npm install` 후 `npm run build`를 실행합니다.
6. 서버 실행 후 `/os`에서 Diagnostics와 데이터 상태를 확인합니다.

## 신규 기능
- `/os`: AI Company OS 통합 화면
- `/api/os/overview`: Business Core 운영 요약
- `/api/system/health`: 환경·DB·Engine·Worker 진단
- `/api/workers`: AI Worker Registry
- `/api/releases`: Release Manager
- `016_ai_company_os_foundation.sql`: Worker, Release, Health, Revenue Snapshot 및 Decision Evidence

## 검증
- `/os` 화면 로딩
- Environment/Database Health 상태 확인
- AI Worker 7개 표시
- Release v10.0.0 표시
- 기존 상품·Workflow·Coupang 화면 정상 접근

## 주의
로그인 세션이 필요한 쿠팡 Wing 화면을 AI가 직접 점검하는 기능은 포함하지 않습니다. 대신 구조화된 Diagnostics를 통해 캡처 의존도를 줄입니다.
