# 공감라인 AI Commerce OS v9.0

v9.0은 기존 Market, Discovery, Supplier, Procurement, Workspace, Listing, Coupang 엔진을 하나의 상품 Workflow로 연결합니다.

## 적용
1. 기존 마이그레이션 005~012 적용 상태 확인
2. `supabase/migrations/013_commerce_workflow_integration.sql` 실행
3. 기존 `.env.local` 복사
4. `npm install`
5. `npm run build`
6. `npm run dev`

## 화면
- Workflow 통합센터: `http://localhost:3000/workflow`
- 상품 Workspace: `http://localhost:3000/workspace`

## 권장 검증
1. AI 추천 승인
2. Workflow 자동 생성 확인
3. 국내 도매 매핑
4. 견적 수익성 승인
5. 발주 승인 및 상태 변경
6. 3PL 입고 계획
7. Listing 초안 생성 및 승인
8. `/workflow`에서 `전체 자동 동기화` 실행
9. 단계, 업무, 전환 이력, Timeline 확인
