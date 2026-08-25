import assert from "node:assert/strict";
import test from "node:test";

import {
  hasValidAdminMfaGrant,
  issueAdminMfaGrant,
} from "../lib/auth/admin-mfa-grant.server";

process.env.GONGGAMLINE_ADMIN_CSRF_SECRET ??= "test-only-mfa-grant-secret";

const context = {
  administratorUserId: "00000000-0000-0000-0000-000000000001",
  sessionIdentity: "session-1",
};

test("MFA grant is bound to user and session and expires", () => {
  const token = issueAdminMfaGrant(context, () => 1_000_000_000);
  const request = new Request("https://example.test/api/admin/order", {
    headers: { cookie: `__Host-gonggamline-mfa-grant=${token}` },
  });
  assert.equal(hasValidAdminMfaGrant(request, context, () => 1_000_000_001), true);
  assert.equal(hasValidAdminMfaGrant(request, { ...context, sessionIdentity: "other" }, () => 1_000_000_001), false);
  assert.equal(hasValidAdminMfaGrant(request, context, () => 1_000_000_000 + (12 * 60 * 60 + 1) * 1_000), false);
});

test("MFA grant rejects tampering", () => {
  const token = issueAdminMfaGrant(context, () => 1_000_000_000);
  const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
  const request = new Request("https://example.test/api/admin/order", {
    headers: { cookie: `__Host-gonggamline-mfa-grant=${tampered}` },
  });
  assert.equal(hasValidAdminMfaGrant(request, context, () => 1_000_000_001), false);
});
