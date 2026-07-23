# 공감라인 AI v8.2 — Supplier Intelligence Engine

## 적용
1. Supabase SQL Editor에서 `supabase/migrations/010_supplier_intelligence_engine.sql` 실행
2. `npm install`
3. `npm run build`
4. `npm run dev`
5. `http://localhost:3000/sourcing` 접속

## 구현 범위
- 공급처 등록 및 신뢰도 관리
- 승인된 단일·묶음 추천과 공급처 견적 연결
- KRW/USD/CNY와 환율 반영
- MOQ, 국내·국제 운송, 관세, 부가세, 검품, 포장, 라벨, 3PL 입고·보관·출고비 반영
- 쿠팡 수수료 및 예상 반품비 반영
- 착지원가, 개당 순이익, 순마진율, 초기 필요자금, 자금회전일 계산
- approve/review/reject 판단 및 계산 이력 저장

## 주의
현재 RLS 정책은 개발 편의를 위한 전체 허용 정책입니다. 운영 배포 전에 인증 사용자/사업자 기준 정책으로 교체해야 합니다.
