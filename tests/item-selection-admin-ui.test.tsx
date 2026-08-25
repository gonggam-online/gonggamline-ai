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
  assert.match(component, /"X-GonggamLine-CSRF": csrf\.token/);
  assert.doesNotMatch(component, /X-CSRF-Token/);
  assert.doesNotMatch(component, /finalize/);
});

test("CSRF denial is distinct from fresh-MFA authorization failure", () => {
  assert.match(
    component,
    /if \(code === "CSRF_DENIED"\)[\s\S]*if \(status === 403\)/,
  );
  assert.match(component, /요청 검증에 실패했습니다/);
  assert.match(component, /최근 MFA 인증이 필요합니다/);
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
  assert.match(component, /평가가 예상 완료 시간을 초과했습니다/);
});

test("unknown financial data stays visibly unknown", () => {
  assert.match(component, /확인 필요/);
  assert.match(component, /모든 검색 후보에 기회 점수와 순위를 부여합니다/);
  assert.doesNotMatch(component, /Product.*create|Coupang.*write/i);
});

test("persisted score units are rendered on the zero-to-one-hundred scale", () => {
  assert.match(component, /종합 평가 점수/);
  assert.match(component, /totalScoreUnits \/ 10_000/);
  assert.doesNotMatch(component, /확정 총점/);
});

test("current Coupang market price evidence is visible in profitability detail", () => {
  assert.match(component, /쿠팡 예상 실판매가/);
  assert.match(component, /쿠팡 관찰 가격 범위/);
  assert.match(component, /네이버 공식 쇼핑검색/);
  assert.match(component, /가격 산출에 사용한 쿠팡 관찰 상품/);
});
