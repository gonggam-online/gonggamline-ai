import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("app/api/market/intelligence/route.ts", "utf8");
const page = readFileSync("app/market/page.tsx", "utf8");

test("market intelligence rebuild is an authenticated CSRF-bound read workflow", () => {
  assert.match(source, /requireAdminRequest\(request, "read"\)/);
  assert.match(source, /requireExactAdminOrigin\(request\)/);
  assert.match(source, /requireJsonContentType\(request\)/);
  assert.match(
    source,
    /verifyAdminCsrfToken\(request, "market-collection-run", context\)/,
  );
  assert.match(source, /rebuildAutonomousMarketIntelligence\(\)/);
});

test("Engine 1 exposes separate recompute and refresh actions", () => {
  assert.match(page, /고신뢰 SKU 탐색·재산출/);
  assert.match(page, /고신뢰 선정 기준과 원천소스/);
  assert.match(page, /시장매칭 45점 이상/);
  assert.match(page, /동일 SKU 상품출처 2개 이상/);
  assert.match(page, /14일 이내 관측/);
  assert.match(page, /리뷰≤후보 중앙값/);
  assert.match(page, /supplier_quotes/);
  assert.match(page, /upstreamSource 기준/);
  assert.match(page, /저장 결과 새로고침/);
  assert.match(page, /\/api\/market\/intelligence/);
  assert.match(page, /자동 교차검증 중/);
  assert.match(page, /부족한 후보로 숫자를 채우지 않습니다/);
  assert.match(
    page,
    /item\.qualification === "SELL_READY" \|\|\s+item\.qualification === "HIGH_CONFIDENCE"/,
  );
  assert.match(page, /item\.identityProviders\?\.length \?\? 0/);
  assert.match(page, /item\.estimatedMonthlyRevenueKrw/);
  assert.match(page, /availabilityLabel\(item\.availability\)/);
});

test("rebuild schedules bounded official-provider SKU verification jobs", () => {
  const orchestration = readFileSync(
    "services/autonomous-market-discovery.service.ts",
    "utf8",
  );
  assert.match(orchestration, /SKU 자동 교차검증/);
  assert.match(orchestration, /queries\.slice\(0, 12\)/);
  assert.match(orchestration, /naver-shopping-api/);
  assert.match(orchestration, /dataforseo-naver-serp/);
  assert.match(orchestration, /youtube-public-signals/);
  assert.match(orchestration, /skuDiscoveryLoop/);
  const runner = readFileSync(
    "services/market-orchestration.service.ts",
    "utf8",
  );
  assert.match(runner, /keywordCategory === "SKU 자동 교차검증"/);
  assert.match(runner, /collectDataForSeoCoupangPrices\(keyword\)/);
  assert.match(runner, /source: "coupang_public"/);
});
