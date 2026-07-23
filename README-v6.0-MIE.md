# Gonggamline AI v6.0 MIE

## 적용
1. Supabase SQL Editor에서 `005`, `006`, `007` 마이그레이션을 순서대로 실행합니다.
2. `.env.local`의 Supabase 설정을 확인합니다.
3. `npm install`
4. `npm run build`
5. `npm run dev`
6. `http://localhost:3000/market` 접속

## 운영 주의
- `/api/market/jobs/run`은 현재 명시적 호출 방식입니다.
- 배포 환경에서는 Vercel Cron 또는 별도 서버 Cron이 이 API를 저빈도로 호출하도록 연결할 수 있습니다.
- 공식 API 어댑터와 공개 페이지 관측 어댑터는 기본적으로 비활성화되어 있습니다.
- 접근 제한 우회, CAPTCHA 우회, 프록시 회전 기능은 포함하지 않습니다.
