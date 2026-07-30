import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative: string): string =>
  readFileSync(path.join(root, relative), "utf8").replaceAll("\r\n", "\n");

test("A01-A04: every business route authenticates before repository access", () => {
  for (const [file, assurance] of [
    ["app/api/admin/item-selection/runs/[id]/route.ts", "read"],
    ["app/api/admin/item-selection/runs/route.ts", "mutation"],
    ["app/api/admin/item-selection/runs/[id]/finalize/route.ts", "mutation"],
  ] as const) {
    const source = read(file);
    const guard = source.indexOf(`requireAdminRequest(request, "${assurance}"`);
    const repository = source.search(
      /getItemSelectionRunById\(|createItemSelectionRun\(|finalizeItemSelectionRun\(/,
    );
    assert.ok(guard >= 0, `${file} must require ${assurance} assurance`);
    assert.ok(repository > guard, `${file} must guard before repository access`);
  }
});

test("A05: both mutations fail closed before body parsing and repository access", () => {
  for (const file of [
    "app/api/admin/item-selection/runs/route.ts",
    "app/api/admin/item-selection/runs/[id]/finalize/route.ts",
  ]) {
    const source = read(file);
    const origin = source.indexOf("requireExactAdminOrigin(request)");
    const contentType = source.indexOf("requireJsonContentType(request)");
    const csrf = source.indexOf("verifyAdminCsrfToken(");
    const body = source.indexOf("request.json()");
    const repository = source.search(
      /createItemSelectionRun\(|finalizeItemSelectionRun\(/,
    );
    assert.ok(origin >= 0 && contentType > origin && csrf > contentType);
    assert.ok(body > csrf && repository > body);
  }
});

test("A02, A03, A07 and A10: verified identity, UUID allowlist and fresh AAL2 are enforced", () => {
  const guard = read("lib/auth/admin-request-guard.server.ts");
  assert.match(guard, /await client\.auth\.getUser\(\)/);
  assert.match(guard, /!isAllowlistedAdminUser\(user\.id\)/);
  assert.match(guard, /claims\.aal !== "aal2" \|\| authenticationAge > 60/);
  assert.match(guard, /new AdminRequestGuardError\(401\)/);
  assert.match(guard, /new AdminRequestGuardError\(403\)/);

  const allowlist = read("lib/auth/admin-allowlist.server.ts");
  assert.match(allowlist, /value\.trim\(\)\.split\(","\)/);
  assert.match(allowlist, /candidate === "" \|\| !UUID_PATTERN\.test\(candidate\)/);
  assert.match(allowlist, /candidate\.toLowerCase\(\)/);

  const logout = read("app/api/admin/auth/logout/route.ts");
  assert.match(logout, /\.auth\.signOut\(/);
  assert.doesNotMatch(logout, /auth\.admin|auth\.sessions/);
});

test("A05: CSRF is purpose, subject, session, expiry, cookie and MAC bound", () => {
  const source = read("lib/auth/csrf.server.ts");
  for (const token of [
    "purpose",
    "context.administratorUserId",
    "context.sessionIdentity",
    "expiry",
    "nonce",
    "timingSafeEqual",
    "header !== cookie",
  ]) {
    assert.ok(source.includes(token), `missing CSRF binding: ${token}`);
  }
  assert.match(source, /ttlSeconds > 15 \* 60/);
});

test("A03/A04 rate boundaries are exact and create/finalize share mutation bucket", () => {
  const source = read("lib/auth/admin-rate-limit.server.ts");
  assert.match(source, /read: 30/);
  assert.match(source, /mutation: 10/);
  assert.match(source, /active\.length >= limit/);
  for (const file of [
    "app/api/admin/item-selection/runs/route.ts",
    "app/api/admin/item-selection/runs/[id]/finalize/route.ts",
  ]) {
    assert.match(read(file), /\.consume\(context\.administratorUserId, "mutation"\)/);
  }
});
