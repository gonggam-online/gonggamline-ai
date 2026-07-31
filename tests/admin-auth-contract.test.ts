import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const source = (relative: string): string =>
  readFileSync(path.join(root, relative), "utf8");

test("A12: Supabase SDK versions and supported SSR/Auth API paths stay pinned", () => {
  const packageJson = JSON.parse(source("package.json")) as {
    dependencies: Record<string, string>;
  };
  assert.equal(packageJson.dependencies["@supabase/supabase-js"], "2.110.7");
  assert.equal(packageJson.dependencies["@supabase/ssr"], "0.12.3");

  assert.match(source("lib/auth/supabase-ssr.server.ts"), /createServerClient/);
  assert.match(source("app/api/admin/auth/login/route.ts"), /signInWithPassword/);
  assert.match(source("app/api/admin/auth/callback/route.ts"), /exchangeCodeForSession/);
  assert.match(source("lib/auth/admin-mfa.server.ts"), /\.mfa\.challenge/);
  assert.match(source("lib/auth/admin-mfa.server.ts"), /\.mfa\.verify/);
  assert.match(source("lib/auth/admin-mfa.server.ts"), /\.mfa\.enroll/);
  assert.match(source("lib/auth/admin-mfa.server.ts"), /\.mfa\.listFactors/);
  assert.match(source("lib/auth/admin-mfa.server.ts"), /\.mfa\.unenroll/);
  assert.match(source("app/api/admin/auth/logout/route.ts"), /\.auth\.signOut/);
});

test("Auth routes never call the Auth Admin API", () => {
  for (const relative of [
    "app/api/admin/auth/login/route.ts",
    "app/api/admin/auth/callback/route.ts",
    "app/api/admin/auth/mfa/challenge/route.ts",
    "app/api/admin/auth/mfa/enroll/route.ts",
    "app/api/admin/auth/mfa/status/route.ts",
    "app/api/admin/auth/mfa/unenroll/route.ts",
    "app/api/admin/auth/mfa/verify/route.ts",
    "app/api/admin/auth/csrf/route.ts",
    "app/api/admin/auth/logout/route.ts",
  ]) {
    assert.doesNotMatch(source(relative), /auth\.admin/);
  }
});

test("Admin login returns factor-aware MFA status without exposing provider errors", () => {
  const login = source("app/api/admin/auth/login/route.ts");
  assert.match(login, /mfa: await readAdminMfaStatus\(client\)/);
  assert.match(login, /AUTHENTICATION_UNAVAILABLE/);
  assert.doesNotMatch(login, /error\.message|console\./);
});
