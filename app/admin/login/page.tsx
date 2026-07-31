"use client";

import { FormEvent, useState } from "react";

import type {
  AdminMfaEnrollmentDto,
  AdminMfaStatusDto,
} from "@/shared/contracts/admin-mfa";

type LoginResponse = Readonly<{
  authenticated: true;
  mfa: AdminMfaStatusDto;
}>;

export default function AdminLoginPage() {
  const [message, setMessage] = useState("");
  const [mfaStatus, setMfaStatus] = useState<AdminMfaStatusDto | null>(null);
  const [enrollment, setEnrollment] =
    useState<AdminMfaEnrollmentDto | null>(null);

  async function issueMfaCsrf(): Promise<string | null> {
    const response = await fetch("/api/admin/auth/csrf?purpose=admin-mfa", {
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }
    const body: unknown = await response.json();
    if (
      typeof body !== "object" ||
      body === null ||
      typeof (body as Record<string, unknown>).token !== "string"
    ) {
      return null;
    }
    return (body as { token: string }).token;
  }

  async function refreshMfaStatus(): Promise<void> {
    const response = await fetch("/api/admin/auth/mfa/status", {
      cache: "no-store",
    });
    if (!response.ok) {
      setMfaStatus(null);
      setMessage("MFA status unavailable.");
      return;
    }
    const status = (await response.json()) as AdminMfaStatusDto;
    setMfaStatus(status);
    setMessage(
      status.assurance.current === "aal2"
        ? "MFA verified."
        : status.enrollmentRequired
          ? "Enroll an authenticator before protected operations."
          : "Enter a current authenticator code to continue.",
    );
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
      }),
    });
    if (!response.ok) {
      setMfaStatus(null);
      setEnrollment(null);
      setMessage("Sign-in failed.");
      return;
    }
    const body = (await response.json()) as LoginResponse;
    setMfaStatus(body.mfa);
    setEnrollment(null);
    setMessage(
      body.mfa.enrollmentRequired
        ? "Signed in. Enroll an authenticator to continue."
        : body.mfa.verificationRequired
          ? "Signed in. Verify your authenticator to continue."
          : "Signed in with MFA.",
    );
  }

  async function enrollMfa(): Promise<void> {
    const token = await issueMfaCsrf();
    if (!token) {
      setMessage("MFA enrollment unavailable.");
      return;
    }
    const response = await fetch("/api/admin/auth/mfa/enroll", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-GonggamLine-CSRF": token,
      },
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      setMessage("MFA enrollment failed.");
      return;
    }
    setEnrollment((await response.json()) as AdminMfaEnrollmentDto);
    await refreshMfaStatus();
    setMessage("Scan the QR code, then verify the six-digit code.");
  }

  async function verifyMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const token = await issueMfaCsrf();
    if (!token) {
      setMessage("MFA verification unavailable.");
      return;
    }
    const factorId =
      enrollment?.factorId ??
      mfaStatus?.factors.find((factor) => factor.status === "verified")?.id ??
      mfaStatus?.factors[0]?.id;
    if (!factorId) {
      setMessage("Enroll an authenticator first.");
      return;
    }
    const challengeResponse = await fetch("/api/admin/auth/mfa/challenge", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-GonggamLine-CSRF": token,
      },
      body: JSON.stringify({ factorId }),
    });
    if (!challengeResponse.ok) {
      setMessage("MFA challenge failed.");
      return;
    }
    const { challengeId } = (await challengeResponse.json()) as {
      challengeId: string;
    };
    const verifyResponse = await fetch("/api/admin/auth/mfa/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-GonggamLine-CSRF": token,
      },
      body: JSON.stringify({
        factorId,
        challengeId,
        code: form.get("code"),
      }),
    });
    if (!verifyResponse.ok) {
      setMessage("MFA verification failed.");
      return;
    }
    setEnrollment(null);
    await refreshMfaStatus();
  }

  async function unenrollMfa(factorId: string): Promise<void> {
    const token = await issueMfaCsrf();
    if (!token) {
      setMessage("MFA removal unavailable.");
      return;
    }
    const response = await fetch("/api/admin/auth/mfa/unenroll", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-GonggamLine-CSRF": token,
      },
      body: JSON.stringify({ factorId }),
    });
    if (!response.ok) {
      setMessage(
        "MFA removal requires a fresh verified code. Contact the repository owner if the authenticator is lost.",
      );
      return;
    }
    setEnrollment(null);
    await refreshMfaStatus();
    setMessage("Authenticator removed.");
  }

  return (
    <main>
      <h1>Admin sign in</h1>
      <form onSubmit={login}>
        <label>
          Email <input name="email" type="email" autoComplete="username" required />
        </label>
        <label>
          Password{" "}
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        <button type="submit">Sign in</button>
      </form>
      <section aria-labelledby="mfa-heading">
        <h2 id="mfa-heading">Authenticator security</h2>
        <button type="button" onClick={refreshMfaStatus}>
          Check MFA status
        </button>
        {mfaStatus?.enrollmentRequired ? (
          <button type="button" onClick={enrollMfa}>
            Enroll authenticator
          </button>
        ) : null}
        {enrollment ? (
          <div>
            <p>Scan this QR code with your authenticator application.</p>
            {/* Supabase returns this one-time SVG; it is never persisted or logged. */}
            <img
              alt="Authenticator enrollment QR code"
              src={enrollment.qrCodeDataUrl}
            />
            <p>
              Manual setup secret: <code>{enrollment.secret}</code>
            </p>
          </div>
        ) : null}
        {mfaStatus && mfaStatus.factors.length > 0 ? (
          <form onSubmit={verifyMfa}>
            <label>
              TOTP code{" "}
              <input
                name="code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                autoComplete="one-time-code"
                required
              />
            </label>
            <button type="submit">Verify MFA</button>
          </form>
        ) : null}
        {mfaStatus?.factors.map((factor) => (
          <p key={factor.id}>
            {factor.friendlyName ?? "Authenticator"}: {factor.status}{" "}
            <button
              type="button"
              onClick={() => unenrollMfa(factor.id)}
              disabled={
                factor.status === "verified" &&
                mfaStatus.assurance.current !== "aal2"
              }
            >
              {factor.status === "verified"
                ? "Remove authenticator"
                : "Cancel enrollment"}
            </button>
          </p>
        ))}
        <p>
          Lost every verified authenticator? Access remains blocked. Ask the
          repository owner to remove the factor in Supabase Dashboard, then
          enroll a replacement here. Automatic reset and recovery codes are not
          supported.
        </p>
      </section>
      <p aria-live="polite">{message}</p>
    </main>
  );
}
