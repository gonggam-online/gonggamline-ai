import Link from "next/link";
import { engineRegistry } from "@/engines/registry";

export default function SystemArchitecturePage() {
  const ready = engineRegistry.filter((engine) => engine.health === "ready").length;
  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "24px", fontFamily: "Arial, sans-serif" }}>
      <section style={{ background: "linear-gradient(135deg,#162a5c,#2457e6)", color: "white", borderRadius: 20, padding: 28 }}>
        <p style={{ fontWeight: 800, letterSpacing: 1 }}>GONGGAMLINE AI · AI COMPANY OS ARCHITECTURE v10.0</p>
        <h1 style={{ fontSize: 36, margin: "10px 0" }}>엔진 중심 모듈 아키텍처</h1>
        <p>기존 기능을 중단하지 않고 Market·Discovery·Supplier·Procurement·Workflow·Bundle·Listing·Coupang·3PL·Learning 엔진으로 분리합니다.</p>
        <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
          <Link href="/os" style={linkStyle}>Company OS</Link>
          <Link href="/market" style={linkStyle}>시장 데이터</Link>
          <Link href="/discovery" style={linkStyle}>AI 상품추천</Link>
          <Link href="/" style={linkStyle}>상품 운영</Link>
          <Link href="/sourcing" style={linkStyle}>공급처·소싱</Link>
          <Link href="/procurement" style={linkStyle}>조달·발주</Link>
          <Link href="/workflow" style={linkStyle}>Workflow 통합</Link>
          <Link href="/seller" style={linkStyle}>쿠팡 판매등록</Link>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14, marginTop: 20 }}>
        <Stat label="등록 엔진" value={engineRegistry.length} />
        <Stat label="Ready" value={ready} />
        <Stat label="전환 중" value={engineRegistry.filter((e) => e.health === "degraded").length} />
        <Stat label="향후 구현" value={engineRegistry.filter((e) => e.health === "disabled").length} />
      </section>

      <section style={{ marginTop: 22, background: "white", border: "1px solid #dbe3f0", borderRadius: 16, padding: 18 }}>
        <h2>Engine Registry</h2>
        <div style={{ display: "grid", gap: 12 }}>
          {engineRegistry.map((engine) => (
            <article key={engine.id} style={{ border: "1px solid #dbe3f0", borderRadius: 12, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <strong>{engine.name}</strong>
                <span>{engine.health} · v{engine.version}</span>
              </div>
              <p style={{ color: "#526071", marginBottom: 6 }}>의존성: {engine.dependencies.join(", ") || "없음"}</p>
              <p style={{ margin: 0 }}>기능: {engine.capabilities.join(" · ") || "구현 예정"}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

const linkStyle = { background: "white", color: "#15357a", padding: "10px 14px", borderRadius: 9, textDecoration: "none", fontWeight: 700 };
function Stat({ label, value }: { label: string; value: number }) {
  return <div style={{ background: "white", border: "1px solid #dbe3f0", borderRadius: 14, padding: 18 }}><div style={{ color: "#657286" }}>{label}</div><div style={{ fontSize: 30, fontWeight: 800 }}>{value}</div></div>;
}
