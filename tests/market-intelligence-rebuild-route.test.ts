import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("app/api/market/intelligence/route.ts", "utf8");
const page = readFileSync("app/market/page.tsx", "utf8");

test("market intelligence rebuild is an authenticated CSRF-bound read workflow", () => {
  assert.match(source, /requireAdminRequest\(request, "read"\)/);
  assert.match(source, /requireExactAdminOrigin\(request\)/);
  assert.match(source, /requireJsonContentType\(request\)/);
  assert.match(source, /verifyAdminCsrfToken\(request, "market-collection-run", context\)/);
  assert.match(source, /rebuildAutonomousMarketIntelligence\(\)/);
});

test("Engine 1 exposes separate recompute and refresh actions", () => {
  assert.match(page, /실제 SKU 상위 10개 재산출/);
  assert.match(page, /저장 결과 새로고침/);
  assert.match(page, /\/api\/market\/intelligence/);
});
