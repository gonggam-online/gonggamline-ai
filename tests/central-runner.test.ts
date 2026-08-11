import assert from "node:assert/strict";
import test from "node:test";

import { categoryCode, parseCentralRunnerRequest } from "@/tools/central-runner/contracts";

const valid = {
  schemaVersion: "1.0.0",
  taskId: "pixtil:test:001",
  sourceProject: "pixtil",
  operation: "COUPANG_CATEGORY_META",
  requestedAt: "2026-08-11T00:00:00.000Z",
  expiresAt: "2026-08-11T00:10:00.000Z",
  idempotencyKey: `sha256:${"a".repeat(64)}`,
  arguments: { displayCategoryCode: "123456" },
} as const;

test("accepts a bounded read-only request", () => {
  const request = parseCentralRunnerRequest(valid, new Date("2026-08-11T00:05:00.000Z"));
  assert.equal(categoryCode(request), "123456");
});

test("rejects expired and write-capable operations", () => {
  assert.throws(() => parseCentralRunnerRequest(valid, new Date("2026-08-11T00:11:00.000Z")), /INVALID_REQUEST/);
  assert.throws(
    () => parseCentralRunnerRequest({ ...valid, operation: "COUPANG_REGISTER_PRODUCT" }, new Date("2026-08-11T00:05:00.000Z")),
    /INVALID_REQUEST/,
  );
});

test("rejects malformed idempotency and category values", () => {
  assert.throws(
    () => parseCentralRunnerRequest({ ...valid, idempotencyKey: "unsafe" }, new Date("2026-08-11T00:05:00.000Z")),
    /INVALID_REQUEST/,
  );
  const request = parseCentralRunnerRequest(
    { ...valid, arguments: { displayCategoryCode: "../../orders" } },
    new Date("2026-08-11T00:05:00.000Z"),
  );
  assert.throws(() => categoryCode(request), /INVALID_ARGUMENTS/);
});
