import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { discoverPublicSupplierCandidates } from "../lib/sourcing/public-supplier-discovery.server.ts";
import {
  PUBLIC_SUPPLIER_PROFILES,
  rankPublicSupplierCandidates,
  supplierProfileFromUrl,
} from "../shared/domain/public-supplier-discovery.ts";

const observedAt = "2026-08-27T00:00:00.000Z";

test("exact model and dimensions outrank category-only wholesale results", () => {
  const candidates = rankPublicSupplierCandidates("KK946 미니 파우치 10.5cm", [
    { supplier: "domeggook", title: "KK946 미니 파우치 블랙 10.5cm", url: "https://domeggook.com/main/item/itemView.php?no=56288849", snippet: "판매중 8,100원", rank: 2 },
    { supplier: "ownerclan", title: "휴대용 수납 파우치", url: "https://ownerclan.com/V2/product/view.php?product_no=OC10001", snippet: "생활잡화 도매 상품", rank: 1 },
  ], observedAt);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].supplier, "domeggook");
  assert.equal(candidates[0].matchLevel, "STRONG_CANDIDATE");
  assert.equal(candidates[0].providerItemId, "56288849");
  assert.equal(candidates[0].publicPriceKrw, 8_100);
  assert.equal(candidates[0].stockStatus, "IN_STOCK");
});

test("unapproved, credentialed, and insecure URLs never enter supplier evidence", () => {
  assert.equal(supplierProfileFromUrl("http://domeggook.com/item/1"), null);
  assert.equal(supplierProfileFromUrl("https://user:pass@domeggook.com/item/1"), null);
  assert.equal(supplierProfileFromUrl("https://domeggook.com.evil.example/item/1"), null);
  assert.equal(supplierProfileFromUrl("https://m.domeggook.com/item/1")?.key, "domeggook");
});

test("sold-out candidates remain visible but rank after available candidates", () => {
  const candidates = rankPublicSupplierCandidates("틈새 수납 선반", [
    { supplier: "dometopia", title: "틈새 수납 선반", url: "https://dometopia.com/goods/view?no=100", snippet: "품절 5,000원", rank: 1 },
    { supplier: "domeggook", title: "틈새 수납 선반", url: "https://domeggook.com/main/item/itemView.php?no=200000", snippet: "판매중 5,500원", rank: 2 },
  ], observedAt);
  assert.equal(candidates[0].stockStatus, "IN_STOCK");
  assert.equal(candidates[1].stockStatus, "OUT_OF_STOCK");
  assert.equal(candidates[1].saleReadiness, "OUT_OF_STOCK");
});

test("one bounded DataForSEO request searches every approved supplier and returns deterministic evidence", async () => {
  let calls = 0;
  let requestBody: Array<Record<string, unknown>> = [];
  let authorization = "";
  const requester = async (_input: string | URL | Request, init?: RequestInit) => {
    calls += 1;
    requestBody = JSON.parse(String(init?.body));
    authorization = new Headers(init?.headers).get("Authorization") ?? "";
    return new Response(JSON.stringify({ tasks: [{ cost: 0.002, result: [{ items: [
      { type: "organic", rank_absolute: 1, title: "KK946 미니 파우치 10.5cm", url: "https://domeggook.com/main/item/itemView.php?no=56288849", description: "판매중 도매가 8,100원" },
      { type: "organic", rank_absolute: 2, title: "위조 도메인", url: "https://domeggook.com.example.org/item/1", description: "1,000원" },
    ] }] }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const options = { credentials: { login: "api@example.com", password: "secret", maximumCostUsd: 0.01 }, request: requester, now: () => new Date(observedAt) };
  const first = await discoverPublicSupplierCandidates("KK946 미니 파우치 10.5cm", options);
  const second = await discoverPublicSupplierCandidates("KK946 미니 파우치 10.5cm", { ...options, request: requester });
  assert.equal(calls, 2);
  assert.equal(first.requestCount, 1);
  assert.equal(first.estimatedCostUsd, 0.002);
  assert.equal(first.candidates.length, 1);
  assert.equal(first.outputDigest, second.outputDigest);
  assert.match(authorization, /^Basic /);
  assert.equal(requestBody[0].depth, 50);
  for (const supplier of PUBLIC_SUPPLIER_PROFILES) assert.match(String(requestBody[0].keyword), new RegExp(`site:${supplier.domain.replaceAll(".", "\\.")}`));
});

test("missing credentials and exceeded request cost fail closed", async () => {
  await assert.rejects(() => discoverPublicSupplierCandidates("틈새 수납", { credentials: { maximumCostUsd: 0.01 } }), /DATAFORSEO_CREDENTIALS_MISSING/);
  await assert.rejects(() => discoverPublicSupplierCandidates("틈새 수납", {
    credentials: { login: "login", password: "password", maximumCostUsd: 0.001 },
    request: async () => new Response(JSON.stringify({ tasks: [{ cost: 0.002, result: [{ items: [] }] }] }), { status: 200 }),
  }), /DATAFORSEO_COST_CEILING_EXCEEDED/);
});

test("Engine 1 and Engine 2 hand off selected products to the sourcing engine", () => {
  const root = process.cwd();
  const market = readFileSync(path.join(root, "app/market/page.tsx"), "utf8");
  const selection = readFileSync(path.join(root, "components/item-selection-admin/item-selection-admin.tsx"), "utf8");
  const sourcing = readFileSync(path.join(root, "app/sourcing/page.tsx"), "utf8");
  assert.match(market, /\/sourcing\?keyword=/);
  assert.match(selection, /이 상품의 공급처 후보 자동 탐색/);
  assert.match(selection, /\/sourcing\?keyword=/);
  assert.match(sourcing, /query\.get\("keyword"\)/);
  assert.match(sourcing, /await discover\(keyword\)/);
});

test("supplier discovery route retains session, origin, CSRF, rate, and secret boundaries", () => {
  const root = process.cwd();
  const route = readFileSync(path.join(root, "app/api/sourcing/public-candidates/route.ts"), "utf8");
  const server = readFileSync(path.join(root, "lib/sourcing/public-supplier-discovery.server.ts"), "utf8");
  assert.match(route, /requireAdminRequest\(request, "read"\)/);
  assert.match(route, /requireExactAdminOrigin\(request\)/);
  assert.match(route, /requireJsonContentType\(request\)/);
  assert.match(route, /verifyAdminCsrfToken\(request, "supplier-public-discovery", context\)/);
  assert.match(route, /adminRateLimiter\.consume/);
  assert.match(server, /DATAFORSEO_MAX_COST_USD_PER_REQUEST/);
  assert.match(server, /requestCount: 1/);
  assert.doesNotMatch(route, /DATAFORSEO_(?:LOGIN|PASSWORD)/);
  assert.doesNotMatch(server, /SUPABASE_SERVICE_ROLE_KEY|COUPANG_SECRET/);
});
