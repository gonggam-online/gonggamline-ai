# Gonggamline AI v11.0 — Autonomous Company Enterprise

## 목적
v10.2 Command Center를 AI CEO 중심의 자율운영 구조로 확장합니다.

## 주요 기능
- AI CEO Daily Brief: 우선순위, 추천 행동, 리스크, 예상 매출·이익
- Autonomous Readiness: 자율운영 준비도와 연결 상태
- Product Center: 최근 상품 후보와 상태
- Profit Center: 매출, 공헌이익, 마진율, ROAS, 손익분기점
- AI Memory: 결정 이유, 근거, 결과, 학습 기록
- Knowledge Center: SOP, Prompt, Playbook, 성공·실패 사례
- Notification Center: 실행, 오류, 품절, 가격, 광고, Worker 알림
- Marketplace Center: 쿠팡 및 확장 채널 연결 상태

## 적용 순서
1. 현재 프로젝트와 `.env.local`을 백업합니다.
2. 전체 패키지를 사용하거나 패치 파일을 덮어씁니다.
3. Supabase SQL Editor에서 `supabase/migrations/018_autonomous_company_enterprise.sql`을 실행합니다.
4. `npm install`, `npm run build`, `npm run dev`를 실행합니다.
5. `http://localhost:3000/os`에 접속합니다.

## 주의
v11.0은 자율운영의 기반과 관제 구조를 제공합니다. 외부 마켓의 실제 자동 등록, 가격 변경, 광고 집행은 API 운영키와 승인 정책이 준비된 뒤 활성화해야 합니다.
