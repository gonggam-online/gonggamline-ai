# 공감라인 AI Commerce OS v1.0 기능 커버리지

## 완료 또는 1차 구현
- [x] 상품 운영 기반
- [x] 시장 데이터 수집·시계열·신호·Feature Warehouse
- [x] AI 단일상품 추천
- [x] 세트·묶음 후보 생성 및 승인
- [x] 국내 공급처·견적·착지원가·수익성 판단
- [x] 도매꾹 상품 연결
- [x] 국내 조달·발주 승인서
- [x] 3PL 입고 계획
- [x] Commerce Workflow 및 Timeline
- [x] Product Workspace
- [x] Listing AI 1차 초안: 상품명·키워드·옵션·상세페이지·FAQ·썸네일 지시서
- [x] 쿠팡 등록 JSON Draft와 사람 승인
- [x] 쿠팡 연결·검증·등록 기반

## 다음 핵심 Sprint
- [ ] Listing 초안을 쿠팡 등록 화면으로 자동 전달
- [ ] 실제 3PL 업체 어댑터 및 창고·입고·재고 동기화
- [ ] 쿠팡 주문·취소·반품 동기화
- [ ] 자동 출고 요청 및 송장 상태
- [ ] 운영센터: 품절·마진하락·재고부족·반품급증 Alert
- [ ] 매출·광고·정산·순이익 Business Manager
- [ ] 실제 판매 결과 기반 Learning Engine
- [ ] 세트·묶음 상품별 합포장·재고 차감 로직
- [ ] 도매꾹 상품 데이터의 합법적·안정적 수집/입력 운영 방식 확정

## v2 이후 확장
- [ ] 도매매·오너클랜 Provider Plugin
- [ ] 해외 공급처·통관·관세·포워더 Import Plugin

## v9.0 Workflow Integration 완료
- [x] 고유 Workflow Code
- [x] 중앙 상태 머신
- [x] 단계 순차 검증 및 멱등성 키
- [x] Discovery 승인 자동 연결
- [x] 소싱 승인 자동 연결
- [x] 발주·3PL 상태 자동 연결
- [x] Listing 생성·승인 자동 연결
- [x] 쿠팡 등록 성공 이벤트 연결 확장점
- [x] 전체 데이터 Reconcile
- [x] 단계별 다음 업무 Queue
- [x] 전환 이력·Timeline·Outbox
- [x] Workflow 통합 운영센터

## v1.0까지 남은 필수 범위
- [ ] 실제 3PL Provider Adapter 및 입출고 동기화
- [ ] 쿠팡 주문·취소·반품·정산 수집
- [ ] 재고 원장과 세트/묶음 구성품 차감
- [ ] Listing Draft → 쿠팡 등록 화면 자동 주입 완성
- [ ] 운영 Alert Center
- [ ] 매출·광고·순이익 Business Manager
- [ ] 실제 성과 기반 Learning/Weight Calibration


## v9.5 Coupang Seller Engine
- [x] 승인 Listing 등록 Queue
- [x] Validation 오류 저장
- [x] 실등록 시도/실패/재시도 이력
- [x] 쿠팡 등록 결과 Workflow 연결
- [x] 등록상품 스냅샷 동기화
- [ ] 3PL 실제 입고·재고·출고 Adapter
- [ ] 주문·취소·반품 수집
- [ ] 실제 순이익 및 정산
- [ ] 판매성과 기반 Learning
