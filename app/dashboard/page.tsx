import type { Metadata } from "next";
import Link from "next/link";

import { ENGINE_NAVIGATION, PLATFORM_NAVIGATION } from "@/lib/dashboard/engine-navigation";

export const metadata: Metadata = {
  title: "7대 엔진 통합 포털 | 공감라인 AI",
  description: "시장 발굴부터 성과학습까지 공감라인 AI의 모든 엔진과 하위 페이지를 한눈에 확인합니다.",
};

export default function EngineDashboardPage() {
  return (
    <main className="engine-portal">
      <section className="engine-portal__hero">
        <p>GONGGAMLINE AI · ENGINE PORTAL</p>
        <h1>7대 엔진 통합 포털</h1>
        <span>시장 발굴부터 판매 성과학습까지, 모든 메인·서브페이지를 한곳에서 엽니다.</span>
      </section>

      <nav className="engine-portal__grid" aria-label="7대 엔진 페이지">
        {ENGINE_NAVIGATION.map((engine) => (
          <section className="engine-portal__group" key={engine.number}>
            <header>
              <strong>{engine.number}</strong>
              <div><h2>{engine.title}</h2><p>{engine.description}</p></div>
            </header>
            <div className="engine-portal__links">
              {engine.pages.map((page) => (
                <Link className={page.primary ? "engine-portal__link is-primary" : "engine-portal__link"} href={page.href} key={page.number}>
                  <b>{page.number}</b>
                  <span><strong>{page.title}</strong><small>{page.description}</small></span>
                  <i aria-hidden="true">→</i>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </nav>

      <section className="engine-portal__platform">
        <div><p>COMMON PLATFORM</p><h2>공통 운영·관제</h2></div>
        <nav aria-label="공통 운영 페이지">
          {PLATFORM_NAVIGATION.map((page) => (
            <Link href={page.href} key={page.href}><strong>{page.title}</strong><small>{page.description}</small></Link>
          ))}
        </nav>
      </section>
    </main>
  );
}
