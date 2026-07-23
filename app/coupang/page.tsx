"use client";

import { useState } from "react";
import Link from "next/link";

type ConnectionResult = {
  ok: boolean;
  message?: string;
  vendorIdMasked?: string;
  account?: {
    restricted?: boolean;
    registeredCount?: number;
    permittedCount?: number | null;
  } | null;
  detail?: unknown;
};

type ProductItem = {
  sellerProductId?: string | number;
  sellerProductName?: string;
  statusName?: string;
  brand?: string;
  createdAt?: string;
  registrationType?: string;
};

export default function CoupangPage() {
  const [testing, setTesting] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [connection, setConnection] = useState<ConnectionResult | null>(null);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [productMessage, setProductMessage] = useState("");

  async function testConnection() {
    setTesting(true);
    setConnection(null);
    try {
      const response = await fetch("/api/coupang/connection-test", { cache: "no-store" });
      const data = (await response.json()) as ConnectionResult;
      setConnection(data);
    } catch {
      setConnection({ ok: false, message: "브라우저에서 연결 테스트 요청을 보내지 못했습니다." });
    } finally {
      setTesting(false);
    }
  }

  async function loadProducts(businessType?: "rocketGrowth") {
    setLoadingProducts(true);
    setProductMessage("");
    try {
      const query = businessType ? "?size=20&businessType=rocketGrowth" : "?size=20";
      const response = await fetch(`/api/coupang/products${query}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        setProducts([]);
        setProductMessage(`상품 조회 실패: ${JSON.stringify(data.detail ?? data.message)}`);
        return;
      }
      const list = Array.isArray(data.result?.data) ? data.result.data : [];
      setProducts(list);
      setProductMessage(list.length ? `${list.length}개 상품을 불러왔습니다.` : "조회된 상품이 없습니다.");
    } catch {
      setProductMessage("상품 조회 요청 중 오류가 발생했습니다.");
    } finally {
      setLoadingProducts(false);
    }
  }

  return (
    <main className="coupang-shell">
      <section className="coupang-hero">
        <div>
          <p className="eyebrow">COUPANG SELLER ENGINE · v9.5</p>
          <h1>쿠팡 Open API 연동 센터</h1>
          <p>인증 상태를 확인하고 내 마켓플레이스·로켓그로스 상품을 안전하게 조회합니다.</p>
        </div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><Link href="/seller" className="ghost-link">등록 운영센터</Link><Link href="/coupang/register" className="ghost-link">상품 등록</Link></div>
      </section>

      <section className="coupang-grid">
        <article className="coupang-panel">
          <h2>1. API 연결 테스트</h2>
          <p className="muted">키 값은 서버의 .env.local에서만 읽으며 브라우저로 전달하지 않습니다.</p>
          <button className="primary-action" onClick={testConnection} disabled={testing}>
            {testing ? "연결 확인 중…" : "쿠팡 API 연결 테스트"}
          </button>
          {connection && (
            <div className={`status-box ${connection.ok ? "success" : "failure"}`}>
              <strong>{connection.ok ? "연결 성공" : "연결 실패"}</strong>
              <p>{connection.message}</p>
              {connection.vendorIdMasked && <p>Vendor ID: {connection.vendorIdMasked}</p>}
              {connection.account && (
                <dl className="account-stats">
                  <div><dt>등록 상품</dt><dd>{connection.account.registeredCount ?? "-"}</dd></div>
                  <div><dt>등록 제한</dt><dd>{connection.account.restricted ? "제한됨" : "정상"}</dd></div>
                  <div><dt>허용 상품 수</dt><dd>{connection.account.permittedCount ?? "무제한"}</dd></div>
                </dl>
              )}
            </div>
          )}
        </article>

        <article className="coupang-panel">
          <h2>2. 내 상품 조회</h2>
          <p className="muted">연결 성공 후 최근 등록상품을 최대 20개 불러옵니다.</p>
          <div className="button-row">
            <button className="secondary-action" onClick={() => loadProducts()} disabled={loadingProducts}>
              마켓플레이스 상품
            </button>
            <button className="secondary-action" onClick={() => loadProducts("rocketGrowth")} disabled={loadingProducts}>
              로켓그로스 상품
            </button>
          </div>
          {productMessage && <p className="product-message">{productMessage}</p>}
        </article>
      </section>

      <section className="coupang-panel product-panel">
        <h2>조회 결과</h2>
        {products.length === 0 ? (
          <div className="empty-state">아직 불러온 쿠팡 상품이 없습니다.</div>
        ) : (
          <div className="coupang-product-list">
            {products.map((product, index) => (
              <article className="coupang-product-card" key={`${product.sellerProductId ?? index}`}>
                <div>
                  <span className="status-chip">{product.statusName ?? "상태 미확인"}</span>
                  <h3>{product.sellerProductName ?? "상품명 없음"}</h3>
                </div>
                <dl>
                  <div><dt>등록상품 ID</dt><dd>{product.sellerProductId ?? "-"}</dd></div>
                  <div><dt>브랜드</dt><dd>{product.brand || "미입력"}</dd></div>
                  <div><dt>등록유형</dt><dd>{product.registrationType ?? "-"}</dd></div>
                  <div><dt>등록일</dt><dd>{product.createdAt ?? "-"}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="security-note">
        <strong>보안:</strong> COUPANG_SECRET_KEY에 NEXT_PUBLIC_ 접두사를 붙이지 마세요. .env.local과 API 키가 포함된 화면은 공유하지 마세요.
      </section>
    </main>
  );
}
