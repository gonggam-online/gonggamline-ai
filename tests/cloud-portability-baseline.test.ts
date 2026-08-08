import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  evaluateReadiness,
  type CloudStateManifest,
  validateCloudStateManifest,
} from "../scripts/check-cloud-portability.ts";

const root = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(
  path.join(root, "docs", "cloud", "cloud-state-manifest.json"),
  "utf8",
)) as CloudStateManifest;

test("cloud-state manifest is complete, sanitized, and evidence-backed", () => {
  assert.deepEqual(validateCloudStateManifest(manifest, (relativePath) =>
    readFileSync(path.join(root, relativePath)).length >= 0), []);
  assert.equal(manifest.entries.some(({ portabilityStatus }) =>
    portabilityStatus === "LOCAL_MIGRATION_BLOCKER"), true);
  assert.equal(manifest.entries.some(({ portabilityStatus }) =>
    portabilityStatus === "REMOTE_AUTHORITATIVE"), true);
});

test("unresolved durable state always retains high-risk migration boundaries", () => {
  for (const entry of manifest.entries) {
    if (
      entry.portabilityStatus === "LOCAL_MIGRATION_BLOCKER" ||
      entry.portabilityStatus === "OWNER_DECISION_REQUIRED"
    ) {
      assert.equal(entry.highRiskBoundary, true, entry.id);
    }
  }
});

test("manifest validation rejects unknown state, duplicate IDs, secrets, and missing evidence", () => {
  const first = manifest.entries[0];
  assert.ok(first);
  const invalid = [
    { ...manifest, schemaVersion: "unknown" },
    { ...manifest, entries: [...manifest.entries, first] },
    { ...manifest, entries: [{ ...first, currentAuthority: `gh${"p"}_1234567890abcdefghij1234567890` }] },
  ] as CloudStateManifest[];
  for (const candidate of invalid) {
    assert.notDeepEqual(validateCloudStateManifest(candidate, () => true), []);
  }
  assert.notDeepEqual(validateCloudStateManifest(manifest, () => false), []);
});

test("readiness fails closed when any cross-PC prerequisite fails", () => {
  const ready = evaluateReadiness([
    { id: "git", passed: true, detail: "ok" },
    { id: "auth", passed: true, detail: "ok" },
  ]);
  assert.equal(ready.ready, true);
  assert.deepEqual(ready.failed, []);

  const blocked = evaluateReadiness([
    { id: "git", passed: true, detail: "ok" },
    { id: "auth", passed: false, detail: "missing" },
  ]);
  assert.equal(blocked.ready, false);
  assert.deepEqual(blocked.failed.map(({ id }) => id), ["auth"]);
});

test("readiness implementation never reads or emits secret values", () => {
  const source = readFileSync(path.join(root, "scripts", "check-cloud-portability.ts"), "utf8");
  assert.equal(/\.env\.local|SUPABASE_SERVICE_ROLE_KEY|process\.env\[["'][A-Z_]+/.test(source), false);
  assert.equal(/console\.log\(process\.env|JSON\.stringify\(process\.env/.test(source), false);
  assert.match(source, /gh.*auth.*status/);
});
