import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const collection = readFileSync(
  path.join(root, "app/api/admin/item-selection/runs/route.ts"), "utf8",
);
const detail = readFileSync(
  path.join(root, "app/api/admin/item-selection/runs/[id]/route.ts"), "utf8",
);

test("Story 4 exposes exactly the approved collection POST/list and detail GET routes", () => {
  assert.match(collection, /export async function POST/);
  assert.match(collection, /export async function GET/);
  assert.match(detail, /export async function GET/);
  assert.equal(
    existsSync(path.join(root, "app/api/admin/item-selection/runs/[id]/finalize/route.ts")),
    false,
  );
});

test("mutation owns AAL2, exact-origin CSRF, idempotency and rate limiting before workflow", () => {
  const guard = collection.indexOf('requireAdminRequest(request, "mutation")');
  const origin = collection.indexOf("requireExactAdminOrigin(request)");
  const csrf = collection.indexOf('verifyAdminCsrfToken(request, "item-selection-create", context)');
  const rate = collection.indexOf("adminRateLimiter.consume");
  const globalRate = collection.indexOf('adminRateLimiter.consume("item-selection-global"');
  const workflow = collection.indexOf("await runItemSelection");
  assert(guard >= 0 && origin > guard && csrf > origin && rate > csrf &&
    globalRate > rate && workflow > globalRate);
  assert.match(collection, /idempotency-key/);
});

test("request and response capacity are explicitly capped", () => {
  assert.match(collection, /\[10, 20, 30\]/);
  assert.match(collection, /if \(limit > 50\)/);
  assert(collection.includes("Cache-Control") && collection.includes("no-store"));
  assert.doesNotMatch(detail, /canonicalSnapshotText|canonicalEvidenceText/);
});
