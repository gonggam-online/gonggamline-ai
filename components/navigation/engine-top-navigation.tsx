"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import {
  ENGINE_NAVIGATION,
  findEngineForPathname,
  isDashboardPageActive,
  normalizeDashboardPathname,
} from "@/lib/dashboard/engine-navigation";

const ENGINE_THEME = {
  "1": { accent: "#1769aa", surface: "#edf7ff", soft: "#dcefff" },
  "2": { accent: "#6941c6", surface: "#f7f2ff", soft: "#eadfff" },
  "3": { accent: "#c75b12", surface: "#fff6ed", soft: "#ffe6cf" },
  "4": { accent: "#087f72", surface: "#ecfbf7", soft: "#d5f4ec" },
  "5": { accent: "#b4236a", surface: "#fff1f7", soft: "#ffdceb" },
  "6": { accent: "#39741f", surface: "#f1f9ed", soft: "#dff0d5" },
  "7": { accent: "#9a6700", surface: "#fff9e8", soft: "#ffedb8" },
} as const;

export function EngineTopNavigation({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = normalizeDashboardPathname(usePathname());
  const activeEngine = findEngineForPathname(pathname);
  const activeEngineRef = useRef<HTMLLIElement>(null);
  const theme = activeEngine ? ENGINE_THEME[activeEngine.number as keyof typeof ENGINE_THEME] : null;
  const shellStyle = theme
    ? ({ "--engine-accent": theme.accent, "--engine-surface": theme.surface, "--engine-soft": theme.soft } as React.CSSProperties)
    : undefined;

  useEffect(() => {
    const activeItem = activeEngineRef.current;
    const engineList = activeItem?.parentElement;
    if (!activeItem || !engineList) return;
    engineList.scrollTo({
      left: activeItem.offsetLeft - (engineList.clientWidth - activeItem.clientWidth) / 2,
    });
  }, [pathname]);

  return (
    <div className="engine-shell" data-engine={activeEngine?.number ?? "platform"} style={shellStyle}>
      <a className="engine-navigation__skip" href="#engine-page-content">본문으로 바로가기</a>
      <header className="engine-navigation">
        <nav className="engine-navigation__inner" aria-label="7대 엔진 통합 메뉴">
          <Link
            className={`engine-navigation__portal${pathname === "/dashboard" ? " is-active" : ""}`}
            href="/dashboard"
            aria-current={pathname === "/dashboard" ? "page" : undefined}
          >
            <span>GONGGAMLINE AI</span>
            <strong>7대 엔진 통합 포털</strong>
          </Link>

          <ol className="engine-navigation__engines">
            {ENGINE_NAVIGATION.map((engine) => {
              const mainPage = engine.pages.find((page) => page.primary) ?? engine.pages[0];
              const isActiveEngine = activeEngine?.number === engine.number;
              return (
                <li
                  className={isActiveEngine ? "is-active" : ""}
                  data-engine-number={engine.number}
                  key={engine.number}
                  ref={isActiveEngine ? activeEngineRef : undefined}
                >
                  <Link
                    className="engine-navigation__main-link"
                    href={mainPage.href}
                    aria-current={pathname === mainPage.href ? "page" : undefined}
                  >
                    <b>{engine.number}.</b>
                    <span>{engine.title}</span>
                  </Link>
                  {isActiveEngine ? (
                    <ul className="engine-navigation__subpages">
                      {engine.pages.filter((page) => !page.primary).map((page) => (
                        <li key={page.number}>
                          <Link href={page.href} aria-current={isDashboardPageActive(pathname, page.href) ? "page" : undefined}>
                            <b>{page.number}.</b> {page.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </nav>
      </header>
      <div className="engine-shell__content" id="engine-page-content">{children}</div>
    </div>
  );
}
