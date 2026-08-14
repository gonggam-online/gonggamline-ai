import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const architecture = readFileSync(
  path.join(
    process.cwd(),
    "docs/architecture/LISTING-CREATIVE-OPTIMIZATION-PIPELINE-V1.md",
  ),
  "utf8",
);

test("creative optimization architecture is generic and keeps KK946 out of production", () => {
  assert.match(architecture, /product-agnostic default pipeline/);
  assert.match(architecture, /KK946 is an external adapter\/acceptance case only/);
  assert.match(architecture, /production source contains no KK946-specific value/);
});

test("public availability never becomes image edit or generation permission", () => {
  assert.match(architecture, /cannot be encoded as a permission/);
  assert.match(architecture, /Competitor and arbitrary web images are observation-only/);
  assert.match(architecture, /must not store their pixels/);
  assert.match(architecture, /`UNKNOWN` never becomes an operation permission/);
  assert.match(
    architecture,
    /`OWNER_RISK_ACCEPTED`[\s\S]*never\s+becomes a permission/,
  );
});

test("rights capabilities maximize verified operations without blocking unchanged use", () => {
  for (const capability of [
    "commercialUnchangedUse",
    "marketplaceRedistribution",
    "technicalReencode",
    "resizeResample",
    "crop",
    "backgroundRemoval",
    "textOverlay",
    "composite",
    "providerUpload",
    "generativeReference",
    "syntheticOutputCommercialUse",
  ]) {
    assert.match(architecture, new RegExp(`${capability}: RightsDecision`));
  }

  assert.match(
    architecture,
    /`useRights=VERIFIED` with `editRights=UNKNOWN`[\s\S]*never blocks that unchanged minimum packet/,
  );
  assert.match(architecture, /DERIVATIVE_UNAVAILABLE/);
});

test("rendering cannot be faked and keeps external boundaries manual", () => {
  assert.match(architecture, /does not authorize a provider call/);
  assert.match(architecture, /fake output can never be marked deployable/);
  assert.match(architecture, /QA is calculated from the actual artifact/);
  assert.match(
    architecture,
    /managed object-[\s\S]*?storage\/CDN Architecture Story/,
  );
  assert.match(architecture, /Database\/Auth\/RLS/);
  assert.match(architecture, /legacy listing_drafts/);
});

test("candidate approval and conversion learning are digest-bound", () => {
  assert.match(
    architecture,
    /at least two independently reviewable creative\s+candidate\s+sets/,
  );
  assert.match(architecture, /Content approval binds[\s\S]*every asset\/detail\/video digest/);
  assert.match(architecture, /Live-write approval remains separate/);
  assert.match(architecture, /No winner is declared from CTR\/CVR alone/);
  assert.match(architecture, /parallel duplicate listings are\s+forbidden/);
});

test("architecture pins current official and research evidence with limitations", () => {
  assert.match(architecture, /observed 2026-08-14/i);
  assert.match(architecture, /Coupang intellectual-property seller guideline/);
  assert.match(architecture, /Korean Copyright Act/);
  assert.match(architecture, /Google Merchant product-data tips/);
  assert.match(architecture, /Baymard product image\/text research/);
  assert.match(architecture, /not product-specific causal performance/);
});
