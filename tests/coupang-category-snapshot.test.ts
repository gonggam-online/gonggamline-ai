import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  createCoupangCategorySnapshot,
  digestCanonicalJson,
} from "../engines/listing/category-snapshot.ts";

const fixture = JSON.parse(readFileSync(
  path.join(process.cwd(), "tests/fixtures/coupang-category-metadata-contract.json"),
  "utf8",
)) as { response: unknown };

function snapshot(overrides: Partial<Parameters<typeof createCoupangCategorySnapshot>[0]> = {}) {
  return createCoupangCategorySnapshot({
    displayCategoryCode: "78877",
    channel: "MARKETPLACE",
    observedAt: "2026-08-08T00:00:00.000Z",
    evaluatedAt: "2026-08-08T01:00:00.000Z",
    selectedNoticeCategoryName: "기타 재화",
    metadataResponse: fixture.response,
    validityResponse: { code: "SUCCESS", message: "", data: true },
    ...overrides,
  });
}

test("valid metadata and separate validity proof produce a bounded snapshot", () => {
  const result = snapshot();
  assert.equal(result.disposition, "VALIDATED");
  assert.equal(result.categoryValid, true);
  assert.equal(result.attributes.length, 1);
  assert.equal(result.noticeCategories.length, 1);
  assert.match(result.metadataDigest, /^[a-f0-9]{64}$/);
  assert.match(result.validityDigest, /^[a-f0-9]{64}$/);
});

test("canonical digest is deterministic across object key order", () => {
  assert.equal(digestCanonicalJson({ b: 2, a: 1 }), digestCanonicalJson({ a: 1, b: 2 }));
  assert.equal(digestCanonicalJson({ value: undefined }), null);
});

test("metadata success never substitutes for category validity", () => {
  const result = snapshot({ validityResponse: { code: "SUCCESS", message: "", data: false } });
  assert.equal(result.disposition, "QUARANTINED");
  assert.ok(result.issues.some(({ code }) => code === "CATEGORY_NOT_VALID"));
});

test("unknown enum and stale snapshots fail closed", () => {
  const metadata = structuredClone(fixture.response) as {
    data: { attributes: Array<Record<string, unknown>> };
  };
  metadata.data.attributes[0].required = "NEW_PROVIDER_ENUM";
  const result = snapshot({
    metadataResponse: metadata,
    observedAt: "2026-07-01T00:00:00.000Z",
  });
  assert.equal(result.disposition, "QUARANTINED");
  assert.deepEqual(
    new Set(result.issues.map(({ code }) => code)),
    new Set(["INVALID_ENUM", "STALE_SNAPSHOT"]),
  );
});

test("notice category is an operator evidence choice, never first-item inference", () => {
  const result = snapshot({ selectedNoticeCategoryName: "존재하지 않는 고시" });
  assert.equal(result.disposition, "QUARANTINED");
  assert.ok(result.issues.some(({ code }) => code === "NOTICE_CATEGORY_NOT_FOUND"));
});

test("validity adapter remains a read-only exact-code endpoint", () => {
  const source = readFileSync(path.join(process.cwd(), "lib/coupang/category.ts"), "utf8");
  assert.match(source, /display-categories\/\$\{displayCategoryCode\}\/status/);
  assert.match(source, /getCoupangCategoryValidity[\s\S]*method:\s*"GET"/);
});
