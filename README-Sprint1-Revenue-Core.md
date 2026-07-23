# Sprint 1 · Revenue Core Foundation

기준 버전: v11.0 Autonomous Company Enterprise  
Blueprint: 공감라인 AI Company OS Master Blueprint v2.0 Draft 1

## 목표
상품 중심 운영을 Revenue Opportunity 중심 운영으로 전환하고, AI Worker가 처리할 공통 Runtime Queue와 Decision/Memory 기록 기반을 추가합니다.

## 적용 순서
1. 프로젝트를 백업합니다.
2. Supabase SQL Editor에서 `supabase/migrations/019_sprint1_revenue_core_foundation.sql`을 실행합니다.
3. 이 Update Pack의 파일을 기존 v11.0 프로젝트에 덮어씁니다.
4. `npm install`
5. `npm run build`
6. `npm run dev`
7. `/revenue`와 `/os`를 확인합니다.

## 신규 기능
- Revenue Opportunity Pipeline
- Revenue Score Engine
- Runtime Job Queue
- Revenue Decision Records
- AI Memory 연동
- Revenue Center UI
- Opportunity 생성 및 상태 전환 API

## 주요 경로
- `/revenue`
- `/api/revenue/dashboard`
- `/api/revenue/opportunities`
- `/api/revenue/jobs`
