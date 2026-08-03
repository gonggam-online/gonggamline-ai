import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const runbook = new URL(
  "../docs/runbooks/ITEM-SELECTION-STORY-6-PRODUCTION-RELEASE.md",
  import.meta.url,
);

test("Story 6 pins the exact dependency and migration evidence", async () => {
  const source = await readFile(runbook, "utf8");
  for (const pr of [36, 37, 72, 73, 74]) {
    assert.match(source, new RegExp(`\\| #${pr} \\|`));
  }
  assert.match(source, /09b1bd3973a5f4cc35b20a83ada1b2575781c1e4/);
  assert.match(source, /91db6288ffb64261a92cb9524cd33bec907b484b1a4e9ce05c7bf574a059fb5a/);
  assert.match(source, /exact 000–023 parity/);
  assert.match(source, /require exactly migration 024/);
});

test("Story 6 remains manual and fail-closed", async () => {
  const source = await readFile(runbook, "utf8");
  assert.match(source, /OWNER APPROVAL REQUIRED/);
  assert.match(source, /high-risk\/manual/);
  assert.match(source, /Stop before the first write/);
  assert.match(source, /Do not repair drift in application code/);
  assert.match(source, /never delete immutable Item Selection\s+history/);
  assert.doesNotMatch(source, /auto-merge/i);
});

test("live verification is bounded and excludes commerce", async () => {
  const source = await readFile(runbook, "utf8");
  assert.match(source, /one administrator/);
  assert.match(source, /size `10`/);
  assert.match(source, /one provider list call and no detail fan-out/);
  assert.match(source, /Do not run a second live attempt/);
  assert.match(source, /Product or external commerce table\/API mutation/);
  assert.match(source, /30 minutes after the approved live smoke/);
});
