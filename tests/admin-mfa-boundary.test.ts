import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const source = (relative: string): string =>
  readFileSync(path.join(root, relative), "utf8");

const mutationRoutes = [
  "app/api/admin/auth/mfa/enroll/route.ts",
  "app/api/admin/auth/mfa/challenge/route.ts",
  "app/api/admin/auth/mfa/verify/route.ts",
  "app/api/admin/auth/mfa/unenroll/route.ts",
];

test("MFA enrollment is explicit, TOTP-only, server-owned, and no-store", () => {
  const boundary = source("lib/auth/admin-mfa.server.ts");
  const route = source("app/api/admin/auth/mfa/enroll/route.ts");

  assert.match(boundary, /^import "server-only";/);
  assert.match(boundary, /factorType: "totp"/);
  assert.match(boundary, /status\.factors\.length !== 0/);
  assert.match(
    boundary,
    /SVG_DATA_URL_PREFIX = "data:image\/svg\+xml;utf-8,"/,
  );
  assert.match(boundary, /qrCode\.startsWith\(SVG_DATA_URL_PREFIX\)/);
  assert.match(boundary, /qrCode\.startsWith\("<svg"\)/);
  assert.match(boundary, /encodeURIComponent\(qrCode\)/);
  assert.match(boundary, /if \(!qrCodeDataUrl\)/);
  assert.match(route, /beginAdminTotpEnrollment/);
  assert.match(route, /"Cache-Control": "no-store"/);
  assert.doesNotMatch(route, /GET\s*\(/);
});

test("every MFA mutation requires exact origin, JSON, CSRF, and rate limiting", () => {
  for (const relative of mutationRoutes) {
    const route = source(relative);
    assert.match(route, /requireExactAdminOrigin\(request\)/, relative);
    assert.match(route, /requireJsonContentType\(request\)/, relative);
    assert.match(
      route,
      /verifyAdminCsrfToken\(request, "admin-mfa", context\)/,
      relative,
    );
    assert.match(route, /adminRateLimiter\.consume/, relative);
  }
});

test("factor IDs are accepted only after ownership and TOTP checks", () => {
  const boundary = source("lib/auth/admin-mfa.server.ts");
  assert.match(boundary, /factor_type === "totp"/);
  assert.match(boundary, /status\.factors\.find/);
  assert.match(boundary, /MFA_FACTOR_NOT_FOUND/);
  assert.match(boundary, /TOTP_CODE_PATTERN = \/\^\[0-9\]\{6\}\$\//);

  for (const relative of [
    "app/api/admin/auth/mfa/challenge/route.ts",
    "app/api/admin/auth/mfa/verify/route.ts",
    "app/api/admin/auth/mfa/unenroll/route.ts",
  ]) {
    assert.match(source(relative), /AdminMfaBoundaryError/, relative);
  }
});

test("verified-factor removal requires fresh AAL2 while abandoned enrollment can be cancelled", () => {
  const route = source("app/api/admin/auth/mfa/unenroll/route.ts");
  assert.match(route, /factor\.status === "verified"/);
  assert.match(route, /requireAdminRequest\(request, "mutation", \{ client \}\)/);
  assert.match(route, /unenrollAdminTotpFactor/);
});

test("recovery fails closed to the repository-owner Dashboard boundary", () => {
  const contract = source("shared/contracts/admin-mfa.ts");
  const page = source("app/admin/login/page.tsx");
  const implementation = source("lib/auth/admin-mfa.server.ts");

  assert.match(contract, /automaticReset: false/);
  assert.match(contract, /mode: "owner-dashboard"/);
  assert.match(page, /Automatic reset and recovery codes are not\s+supported/);
  assert.doesNotMatch(implementation, /auth\.admin|generateLink|recoveryCode/i);
});

test("login UI never asks operators to copy a factor ID", () => {
  const page = source("app/admin/login/page.tsx");
  assert.doesNotMatch(page, /name="factorId"/);
  assert.match(page, /Enroll authenticator/);
  assert.match(page, /Authenticator enrollment QR code/);
  assert.match(page, /pattern="\[0-9\]\{6\}"/);
  assert.match(page, /Check MFA status/);
});

test("status exposes only the strict sanitized factor contract", () => {
  const contract = source("shared/contracts/admin-mfa.ts");
  const statusContract = contract.slice(
    contract.indexOf("export type AdminMfaStatusDto"),
    contract.indexOf("export type AdminMfaEnrollmentDto"),
  );
  const boundary = source("lib/auth/admin-mfa.server.ts");
  const statusRoute = source("app/api/admin/auth/mfa/status/route.ts");

  assert.match(contract, /friendlyName: string \| null/);
  assert.match(contract, /status: AdminMfaFactorStatus/);
  assert.doesNotMatch(statusContract, /secret|qrCode|uri:/);
  assert.match(boundary, /friendlyName: factor\.friendly_name \?\? null/);
  assert.match(statusRoute, /requireAdminRequest\(request, "read"/);
  assert.match(statusRoute, /"Cache-Control": "no-store"/);
});

test("MFA routes never use Auth Admin APIs or log provider material", () => {
  const paths = [
    "lib/auth/admin-mfa.server.ts",
    "app/api/admin/auth/mfa/status/route.ts",
    ...mutationRoutes,
  ];
  for (const relative of paths) {
    const contents = source(relative);
    assert.doesNotMatch(contents, /auth\.admin/, relative);
    assert.doesNotMatch(contents, /console\.(?:log|error|warn)/, relative);
  }
});
