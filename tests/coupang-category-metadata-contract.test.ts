import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const route = readFileSync(path.join(root, "app/api/coupang/categories/meta/route.ts"), "utf8");
const adapter = readFileSync(path.join(root, "lib/coupang/category.ts"), "utf8");
const types = readFileSync(path.join(root, "types/coupang.ts"), "utf8");
const fixtureText = readFileSync(
  path.join(root, "tests/fixtures/coupang-category-metadata-contract.json"),
  "utf8",
);
const fixture = JSON.parse(fixtureText) as {
  fixtureKind: string;
  displayCategoryCode: string;
  response: { data: Record<string, unknown> };
};

test("category metadata adapter remains a read-only exact display-category lookup", () => {
  assert.match(adapter, /method:\s*"GET"/);
  assert.match(adapter, /category-related-metas\/display-category-codes\/\$\{displayCategoryCode\}/);
  assert.doesNotMatch(adapter, /method:\s*"(?:POST|PUT|PATCH|DELETE)"/);
  assert.match(route, /normalizeDisplayCategoryCode/);
});

test("synthetic fixture captures every official registration-relevant collection", () => {
  assert.equal(fixture.fixtureKind, "SYNTHETIC_OFFICIAL_SHAPE");
  assert.match(fixture.displayCategoryCode, /^\d+$/);
  for (const field of [
    "attributes",
    "noticeCategories",
    "requiredDocumentNames",
    "certifications",
    "allowedOfferConditions",
  ]) {
    assert.equal(Array.isArray(fixture.response.data[field]), true, field);
  }
  assert.doesNotMatch(fixtureText, /AKIA[0-9A-Z]{16}|secret|password|vendorId/i);
});

test("current public response is explicitly untyped and cannot be registration-ready evidence", () => {
  assert.match(types, /CoupangCategoryMeta\s*=\s*Record<string, unknown>/);
  assert.match(route, /\{ ok: true, result: result\.data \}/);
});
