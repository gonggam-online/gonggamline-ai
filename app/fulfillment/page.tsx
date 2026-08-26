import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "4. 물류·재고·출고 | 공감라인 AI",
  description: "3PL 입고, 검수, 재고, 주문수집, 출고와 운송장 상태를 연결하는 운영 허브입니다.",
};

const stages = [
  ["3-1", "발주·입고 준비", "/procurement", "발주서와 3PL 입고계획을 생성하고 진행 상태를 관리합니다."],
  ["4-1", "물류·재고 통합 Workspace", "/workspace", "상품별 공급처·발주·입고·재고·Listing 상태를 함께 확인합니다."],
] as const;

export default function FulfillmentPage() {
  return (
    <main className="dashboard">
      <section className="hero fulfillment-hero">
        <div><p className="eyebrow">ENGINE 4 · FULFILLMENT</p><h1>4. 물류·재고·출고</h1><p className="hero-description">3PL 입고부터 검수·재고·주문수집·고객 출고·운송장·반품까지 하나의 물류 상태로 연결합니다.</p></div>
        <div className="hero-actions"><Link className="button-link secondary-button" href="/dashboard">7대 엔진 전체보기</Link></div>
      </section>
      <section className="panel">
        <div className="section-heading"><div><h2>현재 연결된 물류 화면</h2><p>기존 URL과 기능을 유지하면서 4번 엔진 아래에 정리했습니다.</p></div></div>
        <div className="fulfillment-link-grid">
          {stages.map(([number, title, href, description]) => <Link href={href} key={number}><span>{number}</span><strong>{title}</strong><p>{description}</p></Link>)}
        </div>
      </section>
      <section className="panel"><h2>운영 범위</h2><div className="pipeline"><span>입고 신청</span><b>→</b><span>검수·바코드</span><b>→</b><span>재고</span><b>→</b><span>주문수집</span><b>→</b><span>출고·운송장</span><b>→</b><span>반품·재입고</span></div></section>
    </main>
  );
}
