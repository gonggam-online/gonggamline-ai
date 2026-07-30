"use client";

import { FormEvent, useState } from "react";

export default function AdminLoginPage() {
  const [message, setMessage] = useState("");

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
    setMessage(response.ok ? "Signed in." : "Sign-in failed.");
  }

  async function verifyMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const csrfResponse = await fetch(
      "/api/admin/auth/csrf?purpose=admin-session",
    );
    if (!csrfResponse.ok) {
      setMessage("MFA verification unavailable.");
      return;
    }
    const { token } = (await csrfResponse.json()) as { token: string };
    const factorId = String(form.get("factorId") ?? "");
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
    setMessage(verifyResponse.ok ? "MFA verified." : "MFA verification failed.");
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
      <form onSubmit={verifyMfa}>
        <label>
          Factor ID <input name="factorId" autoComplete="off" required />
        </label>
        <label>
          TOTP code{" "}
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
          />
        </label>
        <button type="submit">Verify MFA</button>
      </form>
      <p aria-live="polite">{message}</p>
    </main>
  );
}
