# v8.1 Commerce OS Architecture Update

이 버전은 기능을 제거하거나 데이터베이스를 변경하지 않는 안전한 구조 전환 버전입니다.

## 확인 주소
- `/system` 엔진 레지스트리
- `/market` 시장 엔진
- `/discovery` 상품 발굴 엔진
- `/` 상품 운영

## 실행
```bash
npm install
npm run build
npm run dev
```

이번 버전에는 신규 Supabase 마이그레이션이 없습니다.
