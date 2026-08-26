import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  ENGINE_NAVIGATION,
  PLATFORM_NAVIGATION,
  findEngineForPathname,
  isDashboardPageActive,
} from "../lib/dashboard/engine-navigation";

test("the dashboard exposes exactly seven numbered business engines", () => {
  assert.deepEqual(ENGINE_NAVIGATION.map((engine) => engine.number), ["1", "2", "3", "4", "5", "6", "7"]);
  assert.deepEqual(ENGINE_NAVIGATION.map((engine) => engine.title), [
    "시장정보·아이템 발굴",
    "상품선정·수익성",
    "공급처 소싱·조달",
    "물류·재고·출고",
    "상품 콘텐츠 제작",
    "판매채널 운영",
    "성과분석·학습",
  ]);
});

test("every engine has one main page and uniquely numbered subpages", () => {
  const numbers = ENGINE_NAVIGATION.flatMap((engine) => engine.pages.map((page) => page.number));
  assert.equal(new Set(numbers).size, numbers.length);
  for (const engine of ENGINE_NAVIGATION) {
    assert.equal(engine.pages.filter((page) => page.primary).length, 1);
    assert.equal(engine.pages[0]?.number, engine.number);
    assert.equal(engine.pages[0]?.title, engine.title);
    for (const page of engine.pages.slice(1)) assert.match(page.number, new RegExp(`^${engine.number}-\\d+$`));
  }
});

test("engine and platform links use stable internal routes", () => {
  const links = [...ENGINE_NAVIGATION.flatMap((engine) => engine.pages), ...PLATFORM_NAVIGATION];
  for (const page of links) {
    assert.match(page.href, /^\/(?!\/)/);
    assert.equal(page.href.includes("?"), false);
    const routeFile = page.href === "/"
      ? path.join(process.cwd(), "app", "page.tsx")
      : path.join(process.cwd(), "app", ...page.href.slice(1).split("/"), "page.tsx");
    assert.equal(existsSync(routeFile), true, `${page.href} must have a page.tsx`);
  }
});

test("all seven main pages render their canonical numbered title", () => {
  for (const engine of ENGINE_NAVIGATION) {
    const main = engine.pages[0];
    assert.ok(main);
    const routeFile = path.join(process.cwd(), "app", ...main.href.slice(1).split("/"), "page.tsx");
    const componentFile = engine.number === "2"
      ? path.join(process.cwd(), "components", "item-selection-admin", "item-selection-admin.tsx")
      : routeFile;
    assert.match(readFileSync(componentFile, "utf8"), new RegExp(`${engine.number}\\. ${engine.title}`));
  }
});

test("every main and subpage resolves to its owning engine", () => {
  for (const engine of ENGINE_NAVIGATION) {
    for (const page of engine.pages) {
      assert.equal(findEngineForPathname(page.href)?.number, engine.number, page.href);
      assert.equal(isDashboardPageActive(`${page.href === "/" ? "" : page.href}/`, page.href), true);
    }
  }
  assert.equal(findEngineForPathname("/dashboard"), undefined);
  assert.equal(findEngineForPathname("/system"), undefined);
});

test("the shared top navigation owns portal, main-page, and active-engine subpage links", () => {
  const source = readFileSync(path.join(process.cwd(), "components", "navigation", "engine-top-navigation.tsx"), "utf8");
  assert.match(source, /7대 엔진 통합 포털/);
  assert.match(source, /engine\.pages\.filter\(\(page\) => !page\.primary\)/);
  assert.match(source, /aria-current/);
  assert.match(source, /data-engine-number/);
});

test("engine 1 owns market keyword recommendations and hands selection input to engine 2", () => {
  const market = readFileSync(path.join(process.cwd(), "app", "market", "page.tsx"), "utf8");
  const selection = readFileSync(path.join(process.cwd(), "components", "item-selection-admin", "item-selection-admin.tsx"), "utf8");
  assert.match(market, /시장 데이터 기반 추천 검색어/);
  assert.match(market, /\/admin\/item-selection\?keyword=/);
  assert.doesNotMatch(selection, /fetch\("\/api\/market\/keywords"/);
});
