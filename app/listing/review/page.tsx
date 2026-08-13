import Link from "next/link";

export default function ListingReviewPage() {
  return <main className="dashboard">
    <section className="hero" style={{ background: "linear-gradient(135deg,#123047,#0f766e)" }}><div><p className="eyebrow">LISTING CONTENT REVIEW</p><h1>증거 기반 Listing 검토</h1><p className="hero-description">제목·키워드·이미지·모바일 상세페이지·고시·등록 필드를 하나의 typed packet으로 검토합니다. legacy 초안은 등록 준비 상태가 아니며, 콘텐츠 승인과 실제 게시 권한은 분리됩니다.</p></div><div className="hero-actions"><Link className="button-link secondary-button" href="/listing">Listing 초안으로 돌아가기</Link></div></section>
    <section className="panel"><h2>현재 durable-state 경계</h2><p>새 evidence/content packet을 legacy <code>listing_drafts</code> JSON에 저장하지 않습니다. 승인된 Database/Security Story 전까지 이 화면은 공통 review component와 offline packet 계약만 제공하며, 실제 packet은 승인된 원격 저장소가 생길 때 연결됩니다.</p></section>
    <section className="stat-grid"><article><span>legacy 초안</span><strong>QUARANTINED</strong></article><article><span>콘텐츠 승인</span><strong>별도</strong></article><article><span>게시 권한</span><strong>별도</strong></article><article><span>외부 호출</span><strong>0</strong></article></section>
    <section className="panel"><h2>필수 검토 항목</h2><ul><li>각 제목 토큰·키워드·상세 문구의 evidence fact</li><li>자산 digest·크기·MIME·출처·사용권·편집권·변형·대체 텍스트</li><li>780px 반응형 render의 인코딩·가독성·claim·asset reference</li><li>정확한 category/policy snapshot과 field-addressed 등록 검증</li></ul></section>
  </main>;
}
