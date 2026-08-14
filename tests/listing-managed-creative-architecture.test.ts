import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const architecture = readFileSync(
  path.join(
    process.cwd(),
    "docs/architecture/LISTING-MANAGED-CREATIVE-ASSET-AND-IMAGE-PROVIDER-V1.md",
  ),
  "utf8",
);

test("managed creative architecture is generic and cloud-first", () => {
  assert.match(architecture, /every selected and procurement-approved product/);
  assert.match(
    architecture,
    /never hard-coded in provider or storage\s+production code/,
  );
  assert.match(
    architecture,
    /Supabase Storage private bucket `listing-creative-private-v1`/,
  );
  assert.match(
    architecture,
    /Vercel Blob public store `listing-creative-public-v1`/,
  );
  assert.match(architecture, /public mirror from the Supabase master/);
  assert.match(architecture, /local files, browser downloads, test output/i);
});

test("artifacts are immutable, digest-bound, recoverable, and removable", () => {
  assert.match(
    architecture,
    /v1\/<subjectHash>\/<revisionDigest>\/<role>\/<sha256>/,
  );
  assert.match(architecture, /never overwrite an existing key/);
  assert.match(
    architecture,
    /public object[\s\S]*bytes match the private master digest/,
  );
  assert.match(architecture, /takedown deletes the public object first/);
  assert.match(architecture, /export through the S3-compatible interface/);
  assert.match(architecture, /at least 90 days after final unpublish/);
});

test("provider is pinned and bounded before spend", () => {
  assert.match(architecture, /OpenAI Image API/);
  assert.match(architecture, /`gpt-image-2-2026-04-21`/);
  assert.match(
    architecture,
    /maximum USD 2\.00[\s\S]*per product revision/,
  );
  assert.match(
    architecture,
    /maximum six output images and two provider attempts/,
  );
  assert.match(architecture, /monthly budget USD 50/);
  assert.match(architecture, /stop before a request/);
  assert.match(
    architecture,
    /no paid call from tests, pull requests, Preview/,
  );
});

test("secrets stay server-only and architecture does not perform external writes", () => {
  for (const secret of [
    "OPENAI_API_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "BLOB_READ_WRITE_TOKEN",
  ]) {
    assert.ok(architecture.includes(`\`${secret}\``));
  }

  assert.match(architecture, /never appear in `NEXT_PUBLIC_\*`/);
  assert.match(architecture, /performs no bucket\/store creation/);
  assert.match(architecture, /No public\s+generation route/);
  assert.match(architecture, /Preview and CI use deterministic fakes/);
});

test("provider inputs and outputs remain rights and truth gated", () => {
  assert.match(architecture, /providerUpload=VERIFIED/);
  assert.match(architecture, /generativeReference=VERIFIED/);
  assert.match(
    architecture,
    /competitor and arbitrary web pixels remain observation-only/i,
  );
  assert.match(architecture, /text-to-image independent generation/);
  assert.match(architecture, /PRODUCT_REPRESENTATION_REVIEW_REQUIRED/);
  assert.match(architecture, /do not clear third-party copyright/);
});

test("minimum registration stays separate from conversion optimization", () => {
  assert.match(architecture, /eligible unchanged-source packet/);
  assert.match(architecture, /OPTIMIZATION_UNAVAILABLE/);
  assert.match(architecture, /registration readiness may remain ready/);
  assert.match(architecture, /conversion\s+readiness is pending/);
  assert.match(architecture, /live-write approval[\s\S]*separate/);
});

test("KK946 is only an external acceptance boundary and is not falsely deployable", () => {
  assert.match(architecture, /KK946 remains an external acceptance packet/);
  assert.match(architecture, /cannot be sent to this provider/);
  assert.match(
    architecture,
    /conversion warning\/pending state, not a registration blocker/,
  );
  assert.match(
    architecture,
    /No generated KK946 artifact may be\s+called deployable/,
  );
});

test("official provider and storage snapshots are versioned with limitations", () => {
  assert.match(
    architecture,
    /Official source snapshots observed 2026-08-14/,
  );
  assert.match(
    architecture,
    /canonical URL,[\s\S]*exact policy\/pricing fields/,
  );
  assert.match(architecture, /Services Agreement/);
  assert.match(architecture, /not legal advice/);
  assert.match(architecture, /ICN1 public mirror exists/);
  assert.match(architecture, /OIDC re-observed 2026-08-14/);
  assert.match(architecture, /billing continuity is not yet verified/);
});
