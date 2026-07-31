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
  assert.match(
    source("app/api/admin/auth/password/reset-request/route.ts"),
    /resetPasswordForEmail/,
  );
  assert.match(
    source("app/api/admin/auth/password/verify-recovery/route.ts"),
    /verifyOtp/,
  );
  assert.match(
    source("app/api/admin/auth/password/update/route.ts"),
    /updateUser/,
  );
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
    "app/api/admin/auth/password/reset-request/route.ts",
    "app/api/admin/auth/password/verify-recovery/route.ts",
    "app/api/admin/auth/password/update/route.ts",
  ]) {
    assert.doesNotMatch(source(relative), /auth\.admin/);
  }
});

test("password recovery is enumeration-safe and uses the fixed PKCE callback", () => {
  const reset = source("app/api/admin/auth/password/reset-request/route.ts");
  assert.match(reset, /requireExactAdminOrigin/);
  assert.match(reset, /requireJsonContentType/);
  assert.match(reset, /adminRateLimiter\.consume\(clientKey\(request\), "mutation"\)/);
  assert.match(
    reset,
    /\/api\/admin\/auth\/callback\?purpose=password-recovery/,
  );
  assert.match(reset, /\{ accepted: true \}/);
  assert.doesNotMatch(reset, /error\.message|console\.|auth\.admin/);
});

test("prefetch-safe recovery verifies a manually entered recovery OTP", () => {
  const verify = source(
    "app/api/admin/auth/password/verify-recovery/route.ts",
  );
  assert.match(verify, /requireExactAdminOrigin/);
  assert.match(verify, /requireJsonContentType/);
  assert.match(verify, /adminRateLimiter\.consume\(clientKey\(request\), "mutation"\)/);
  assert.match(verify, /\/\^\[0-9\]\{8\}\$\//);
  assert.match(verify, /client\.auth\.verifyOtp\(\{/);
  assert.match(verify, /type: "recovery"/);
  assert.match(verify, /client\.auth\.getUser\(\)/);
  assert.match(verify, /isAllowlistedAdminUser\(user\.id\)/);
  assert.match(verify, /issueAdminRecoveryGrant\(context\)/);
  assert.match(verify, /client\.auth\.signOut\(\{ scope: "global" \}\)/);
  assert.match(verify, /"\/admin\/password-recovery"/);
  assert.doesNotMatch(verify, /console\.|error\.message|auth\.admin/);

  const login = source("app/admin/login/page.tsx");
  assert.match(login, /Send recovery code/);
  assert.match(login, /Verify recovery code/);
  assert.match(login, /name="recoveryToken"/);
  assert.match(login, /pattern="\[0-9\]\{8\}"/);
  assert.match(login, /maxLength=\{8\}/);
});

test("recovery callback verifies the allowlisted Auth-server user", () => {
  const callback = source("app/api/admin/auth/callback/route.ts");
  assert.match(callback, /purpose === "password-recovery"/);
  assert.match(callback, /client\.auth\.getUser\(\)/);
  assert.match(callback, /isAllowlistedAdminUser\(user\.id\)/);
  assert.match(callback, /client\.auth\.signOut\(\{ scope: "global" \}\)/);
  assert.match(callback, /"\/admin\/password-recovery"/);
});

test("password update requires recovery CSRF and forces global sign-out", () => {
  const update = source("app/api/admin/auth/password/update/route.ts");
  assert.match(update, /requireExactAdminOrigin/);
  assert.match(update, /requireJsonContentType/);
  assert.match(update, /requireAdminRequest\(request, "read"/);
  assert.match(
    update,
    /verifyAdminCsrfToken\(request, "admin-password-recovery", context\)/,
  );
  assert.match(update, /client\.auth\.updateUser\(\{ password \}\)/);
  assert.match(update, /client\.auth\.signOut\(\{ scope: "global" \}\)/);
  assert.match(update, /reauthenticationRequired: true/);
  assert.doesNotMatch(update, /error\.message|console\.|auth\.admin/);
});

test("recovery UI never places recovery material in client-visible source", () => {
  const page = source("app/admin/password-recovery/page.tsx");
  const form = source(
    "app/admin/password-recovery/password-recovery-form.tsx",
  );
  assert.match(page, /requireAdminRequest\(request, "read"/);
  assert.match(page, /verifyAdminRecoveryGrant\(request, context\)/);
  assert.match(form, /autoComplete="new-password"/);
  assert.doesNotMatch(`${page}\n${form}`, /access_token|refresh_token|location\.hash/);
});

test("ordinary allowlisted sessions cannot become password recovery sessions", () => {
  const grant = source("lib/auth/admin-password-recovery.server.ts");
  const csrf = source("app/api/admin/auth/csrf/route.ts");
  const update = source("app/api/admin/auth/password/update/route.ts");
  assert.match(grant, /context\.administratorUserId/);
  assert.match(grant, /context\.sessionIdentity/);
  assert.match(grant, /15 \* 60/);
  assert.match(csrf, /verifyAdminRecoveryGrant\(request, context\)/);
  assert.match(update, /verifyAdminRecoveryGrant\(request, context\)/);
});

test("Admin login returns factor-aware MFA status without exposing provider errors", () => {
  const login = source("app/api/admin/auth/login/route.ts");
  assert.match(login, /mfa: await readAdminMfaStatus\(client\)/);
  assert.match(login, /AUTHENTICATION_UNAVAILABLE/);
  assert.doesNotMatch(login, /error\.message|console\./);
});
