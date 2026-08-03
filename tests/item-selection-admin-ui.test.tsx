import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const component = readFileSync(path.join(root, "components/item-selection-admin/item-selection-admin.tsx"), "utf8");
const page = readFileSync(path.join(root, "app/admin/item-selection/page.tsx"), "utf8");

test("admin page composes the bounded Item Selection UI", () => {
  assert.match(page, /<ItemSelectionAdmin/);
  assert.match(component, /\/api\/admin\/item-selection\/runs/);
  assert.match(component, /purpose=item-selection-create/);
  assert.match(component, /Idempotency-Key/);
  assert.doesNotMatch(component, /finalize/);
});

test("execution preserves exact provider and size choices", () => {
  assert.match(component, /provider: "domeggook"/);
  for (const size of [10, 20, 30]) assert.match(component, new RegExp(`value="${size}"`));
  assert.match(component, /retryOfRunId/);
  assert.match(component, /retrySelected/);
  assert.match(component, /명시적 재시도/);
});

test("history, filters, detail, and accessible states are present", () => {
  assert.match(component, /실행 이력 필터/);
  assert.match(component, /평가 결과 필터/);
  assert.match(component, /role="status"/);
  assert.match(component, /DashboardErrorState/);
  assert.match(component, /DashboardEmptyState/);
  assert.match(component, /aria-pressed/);
});

test("unknown financial data stays visibly unknown", () => {
  assert.match(component, /확인 필요/);
  assert.match(component, /권리·비용 근거가 부족한 항목/);
  assert.doesNotMatch(component, /Product.*create|Coupang.*write/i);
});
