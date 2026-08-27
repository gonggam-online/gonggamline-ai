import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("external market imports preserve authenticated same-origin CSRF and bounded writes", () => {
  const route = read("app/api/market/external-import/route.ts");
  assert.match(route, /requireAdminRequest\(request, "read"\)/);
  assert.match(route, /requireExactAdminOrigin\(request\)/);
  assert.match(route, /requireJsonContentType\(request\)/);
  assert.match(route, /verifyAdminCsrfToken\(request, "market-external-import", context\)/);
  assert.match(route, /5_000/);
  assert.doesNotMatch(route, /fetch\(|cookies\(|authorization|password/i);
});

test("external import UI obtains a purpose-bound token and never receives provider secrets", () => {
  const panel = read("components/market/external-import-panel.tsx");
  assert.match(panel, /purpose=market-external-import/);
  assert.match(panel, /X-GonggamLine-CSRF/);
  assert.match(panel, /내부 API 추측·세션 복제·비공식 스크래핑은 사용하지 않습니다/);
  assert.doesNotMatch(panel, /client_secret|api_key|password/i);
});
