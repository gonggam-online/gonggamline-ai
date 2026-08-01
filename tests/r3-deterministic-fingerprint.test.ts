import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const script = readFileSync(path.resolve(import.meta.dirname, "..", "scripts", "get-r3-rehearsal-fingerprints.ps1"), "utf8");

test("R3 fingerprints remove PostgreSQL transport randomness and remain read-only", () => {
  assert.match(script, /\^\\\\\(un\)\?restrict\\s/);
  assert.match(script, /BEGIN READ ONLY/);
  assert.match(script, /--schema-only --no-owner --no-privileges --no-comments/);
  assert.doesNotMatch(script, /migration repair|INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM/i);
});

test("R3 fingerprints retain quarantine and Production gates", () => {
  assert.match(script, /ConfirmedNonProduction/);
  assert.match(script, /ConfirmedQuarantined/);
  assert.match(script, /network mode none and no published ports/);
  assert.match(script, /refuses Production environment markers/);
});
