import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const story = readFileSync(
  path.join(process.cwd(), "docs/architecture/COUPANG-READONLY-PREFLIGHT-EVIDENCE-V1.md"),
  "utf8",
);

test("architecture pins exactly the three official read-only evidence paths", () => {
  assert.match(story, /GET \/v2\/providers\/seller_api\/apis\/api\/v1\/marketplace\/meta\/category-related-metas\/display-category-codes/);
  assert.match(story, /GET \/v2\/providers\/marketplace_openapi\/apis\/api\/v2\/vendor\/shipping-place\/outbound/);
  assert.match(story, /GET \/v2\/providers\/openapi\/apis\/api\/v5\/vendors\/\{vendorId\}\/returnShippingCenters/);
  assert.match(story, /HTTP method is fixed to `GET`/);
});

test("architecture keeps provider-sensitive data out of durable evidence", () => {
  for (const field of ["addresses", "phone numbers", "fees", "authorization headers"]) {
    assert.match(story, new RegExp(field, "i"));
  }
  assert.match(story, /raw\s+responses/i);
  assert.match(story, /request memory only in v1/);
  assert.match(story, /No new durable runtime state is created/);
});

test("architecture cannot authorize Product Creation or live acquisition", () => {
  assert.match(story, /Product Creation, approval request, or any commerce write/);
  assert.match(story, /does not authorize credentials\/configuration,\s*live evidence acquisition/);
  assert.match(story, /no live Coupang request in local, CI, Preview, or Production/i);
});

test("failure taxonomy separates provider configuration from product validity", () => {
  assert.match(story, /CONFIGURATION_UNAVAILABLE/);
  assert.match(story, /AUTHENTICATION_OR_SCOPE/);
  assert.match(story, /RESPONSE_CONTRACT_ERROR/);
  assert.match(story, /must never be reported as a defective KK946\s+product/);
});
