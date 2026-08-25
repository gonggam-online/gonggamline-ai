import assert from "node:assert/strict";
import test from "node:test";

import { buildAdminSessionStatus } from "../lib/auth/admin-session-status.server";

test("keeps mutation readiness limited to a fresh aal2 session", () => {
    const originalNow = Date.now;
    Date.now = () => 1_000_000;
    const context = {
      administratorUserId: "admin",
      aal: "aal2" as const,
      jwtIssuedAt: 999_960,
      sessionIdentity: "session",
      route: "/admin/listing/creative-dispatch",
      correlationId: "corr",
    };
    const status = buildAdminSessionStatus(context, {
      expiresAt: "2026-08-17T00:00:00.000Z",
      refreshAttempted: true,
      trustedBrowserPreference: true,
    });
    assert.equal(status.status, "MFA_VERIFIED");
    assert.equal(status.mutationReady, true);
    assert.equal(status.trustedBrowserPreference, true);
    Date.now = originalNow;
});

test("does not let the trusted-browser preference bypass reauthentication", () => {
    const originalNow = Date.now;
    Date.now = () => 1_000_000;
    const context = {
      administratorUserId: "admin",
      aal: "aal2" as const,
      jwtIssuedAt: 0,
      sessionIdentity: "session",
      route: "/admin/listing/creative-dispatch",
      correlationId: "corr",
    };
    const status = buildAdminSessionStatus(context, {
      expiresAt: null,
      refreshAttempted: false,
      trustedBrowserPreference: true,
    });
    assert.equal(status.status, "REAUTH_REQUIRED");
    assert.equal(status.mutationReady, false);
    Date.now = originalNow;
});

test("a verified MFA grant keeps mutation readiness after the short JWT freshness window", () => {
    const originalNow = Date.now;
    Date.now = () => 1_000_000;
    const context = {
      administratorUserId: "admin",
      aal: "aal2" as const,
      jwtIssuedAt: 999_000,
      sessionIdentity: "session",
      route: "/admin/item-selection",
      correlationId: "corr",
    };
    const status = buildAdminSessionStatus(context, {
      expiresAt: null,
      refreshAttempted: false,
      trustedBrowserPreference: false,
      mfaGrantValid: true,
    });
    assert.equal(status.status, "MFA_VERIFIED");
    assert.equal(status.mutationReady, true);
    Date.now = originalNow;
});
