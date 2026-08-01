import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

test("R3 sidecar pins official artifacts and builds without network", () => {
  const build = read("scripts/build-r3-cli-sidecar.ps1");
  assert.match(build, /supabase_2\.110\.0_linux_amd64\.tar\.gz/);
  assert.match(build, /876f439e85d296bf095d906ca91cadeb5509d753b4d98ee823e5752d578ff92b/);
  assert.match(build, /7b140f374b289a7c2befc338f42ebe6441b7ea838a042bbd5acbfca6ec875818/);
  assert.match(build, /docker build --pull=false --network none/);
  assert.match(build, /USER 65532:65532/);
  assert.match(build, /Remove-Item[\s\S]*-Recurse -Force/);
});

test("R3 repair runner preserves quarantine and fails closed", () => {
  const runner = read("scripts/invoke-r3-history-repair-sidecar.ps1");
  assert.match(runner, /network mode none and no published ports/);
  assert.match(runner, /--network "container:\$DatabaseContainer"/);
  assert.match(runner, /--read-only --cap-drop ALL/);
  assert.match(runner, /--user 65532:65532/);
  assert.match(runner, /no-new-privileges/);
  assert.match(runner, /R3_PGPASS_SOURCE=\/run\/secrets\/pgpass/);
  assert.match(runner, /--tmpfs "\/run\/secure:rw,noexec,nosuid,size=65536"/);
  assert.match(runner, /--tmpfs "\/home\/r3cli:rw,noexec,nosuid,size=65536"/);
  assert.match(runner, /Approved repair plan fingerprint mismatch/);
  assert.match(runner, /refuses Production environment markers/);
  assert.match(runner, /migration repair @versions --status applied/);
  assert.equal(runner.includes("--linked"), false);
  assert.equal(/insert\s+into\s+supabase_migrations/i.test(runner), false);
});

test("R3 sidecar architecture preserves separate execution approval", () => {
  const architecture = read("docs/architecture/R3-ISOLATED-CLI-SIDECAR-V1.md");
  assert.match(architecture, /Executing the runner[\s\S]*requires separate owner approval/);
  assert.match(architecture, /database container remains network[\s\S]*`none`/);
  assert.match(architecture, /No rollback may replay historical DDL/);
});
