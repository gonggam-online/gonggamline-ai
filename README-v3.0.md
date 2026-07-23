# 공감라인 AI v3.0 — 쿠팡 Open API 1차 연동

## 추가 기능
- 서버 전용 HMAC-SHA256 인증 모듈
- `/coupang` API 연동 센터
- 상품 등록 현황 기반 연결 테스트
- 마켓플레이스 상품 목록 조회
- 로켓그로스 상품 목록 조회
- 401/403/IP 오류 안내

## 설정
기존 `.env.local`의 Supabase 값은 유지하고 아래 세 줄을 추가합니다.

```env
COUPANG_ACCESS_KEY=...
COUPANG_SECRET_KEY=...
COUPANG_VENDOR_ID=A00000000
```

Secret Key에는 `NEXT_PUBLIC_`를 붙이면 안 됩니다.

## 실행
```bash
npm install
npm run build
npm run dev
```

브라우저에서 `http://localhost:3000/coupang`을 엽니다.

## 연결 실패 시
- 401: 키 오입력 또는 PC 시간 불일치
- 403 Not allowed IP: WING에 등록한 공인 IP와 현재 호출 IP 불일치
- API 키 신규 발급 직후에는 권한 활성화까지 시간이 걸릴 수 있음
- IP 수정 후 시스템 반영까지 최대 30분 정도 기다린 뒤 재시도
