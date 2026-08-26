import { expect, test } from "@playwright/test";

const run = {
  id: "11111111-1111-4111-8111-111111111111", provider: "domeggook", keyword: "캠핑 테이블",
  requestedSize: 10, status: "PARTIAL", rulesetVersion: "gonggamline-item-selection-v2",
  evaluatorVersion: "item-selection-evaluator-v2", profitabilityPolicyVersion: "item-selection-profitability-v1",
  profitabilityCalculationContractVersion: "gonggamline-profitability-calculation-v1", requestFingerprint: "a".repeat(64),
  retryOfRunId: null, startedAt: "2026-08-03T01:00:00.000Z", completedAt: "2026-08-03T01:00:05.000Z",
  failureCode: "CANDIDATE_PARTIAL", observedCandidateCount: 2, successfullyEvaluatedCount: 1,
  persistedEvaluationCount: 1, failedCandidateCount: 1, skippedCandidateCount: 0,
  candidateFailuresSha256: "b".repeat(64), createdAt: "2026-08-03T01:00:00.000Z", evaluations: [],
};
const detail = { ...run, evaluations: [{
  evaluationId: "22222222-2222-4222-8222-222222222222", providerItemNumber: "12345", originalPosition: 0,
  verdict: "MANUAL_REVIEW", totalScoreUnits: null, coverageUnits: 450000, normalizedMarginUnits: null,
  normalizedProfitKrwMicros: null, snapshotSha256: "c".repeat(64), providerEvidenceSha256: "d".repeat(64),
  createdAt: "2026-08-03T01:00:05.000Z",
}] };

for (const viewport of [{ name: "desktop", width: 1280, height: 900 }, { name: "narrow", width: 390, height: 844 }]) {
  test(`${viewport.name} operator can run, filter, and inspect history`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.route("**/api/admin/item-selection/runs?**", (route) => route.fulfill({ json: { data: [run], page: { nextCursor: null } } }));
    await page.route(`**/api/admin/item-selection/runs/${run.id}`, (route) => route.fulfill({ json: { data: detail } }));
    await page.route("**/api/admin/auth/csrf?**", (route) => route.fulfill({ json: { token: "fixture-token", expiresAt: "2026-08-03T02:00:00.000Z" } }));
    await page.route("**/api/admin/item-selection/runs", async (route) => {
      expect(route.request().headers()["idempotency-key"]).toBeTruthy();
      expect(route.request().headers()["x-gonggamline-csrf"]).toBe("fixture-token");
      expect(route.request().headers()["x-csrf-token"]).toBeUndefined();
      expect(route.request().postDataJSON()).toMatchObject({ provider: "domeggook", keyword: "캠핑 의자", size: 10 });
      await route.fulfill({ status: 201, json: { data: detail } });
    });
    await page.goto("/admin/item-selection");
    await expect(page.getByRole("heading", { name: "2. 상품선정·수익성" })).toBeVisible();
    await page.getByRole("button", { name: /캠핑 테이블/ }).click();
    await expect(page.getByText("기회 순위 #1 · 12345")).toBeVisible();
    await expect(page.getByText("확인 필요").first()).toBeVisible();
    await expect(page.getByText("45%")).toBeVisible();
    await page.getByLabel("검색어").fill("캠핑 의자");
    await page.getByRole("button", { name: "평가 실행" }).click();
    await expect(page.locator(".item-selection-admin__live")).toContainText("일부 완료");
  });
}
