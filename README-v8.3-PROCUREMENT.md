# 공감라인 AI v8.3 — 국내 조달·발주·Workflow Engine

## 이번 Sprint 목표
외국 공급처 기능은 확장 포인트만 유지하고, 1차 완성본은 `국내 도매(도매꾹 중심) → 발주 → 3PL 입고계획 → Listing AI → 쿠팡 등록` 흐름으로 고정합니다.

## 구현 기능
- 도매꾹/국내도매 상품번호와 AI 추천 후보 연결
- 승인 견적 기반 Procurement Score 재평가
- 발주번호 자동 생성 및 발주 승인서 저장
- 발주 상태 이력: 승인, 발주완료, 공급처확인, 운송중, 입고완료, 취소
- 3PL 입고계획 표준 데이터 구조
- 상품별 Commerce Workflow 및 Timeline 이벤트
- 공급처·수익성 화면과 조달 화면 연결

## DB 적용
`supabase/migrations/011_procurement_workflow_engine.sql` 실행

## 확인 주소
- `/procurement`
- `/sourcing`
- `/system`

## 다음 Sprint
Listing AI Engine: 상품명, 검색 키워드, 옵션 구조, 상세페이지 구성, FAQ, 썸네일 문구 및 쿠팡 등록 Draft 생성.
