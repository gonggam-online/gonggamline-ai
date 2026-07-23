# Gonggamline AI v9.6

## 적용
1. 기존 v9.5 `.env.local` 복사
2. Supabase SQL Editor에서 `015_ai_decision_engine.sql` 실행
3. `npm install`
4. `npm run build`
5. `npm run dev`

## 브라우저 확인
- http://localhost:3000/market : 시장 데이터 준비
- http://localhost:3000/discovery : AI 의사결정 실행 및 결과 확인

## 주의
현재 AI Decision Engine은 저장된 시장 Feature를 사용하는 설명 가능한 규칙 기반 점수 엔진입니다. 외부 LLM 호출 없이 재현 가능하게 동작하며, 실제 품질은 수집된 시장 데이터의 품질과 양에 좌우됩니다.
