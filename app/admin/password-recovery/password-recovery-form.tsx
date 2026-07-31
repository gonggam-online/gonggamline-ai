"use client";

import { FormEvent, useState } from "react";

export function PasswordRecoveryForm() {
  const [message, setMessage] = useState("");
  const [updated, setUpdated] = useState(false);

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const csrfResponse = await fetch(
      "/api/admin/auth/csrf?purpose=admin-password-recovery",
      { cache: "no-store" },
    );
    if (!csrfResponse.ok) {
      setMessage("Recovery session is unavailable. Request a new recovery email.");
      return;
    }
    const csrfBody: unknown = await csrfResponse.json();
    if (
      typeof csrfBody !== "object" ||
      csrfBody === null ||
      typeof (csrfBody as Record<string, unknown>).token !== "string"
    ) {
      setMessage("Recovery session is unavailable. Request a new recovery email.");
      return;
    }

    const response = await fetch("/api/admin/auth/password/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-GonggamLine-CSRF": (csrfBody as { token: string }).token,
      },
      body: JSON.stringify({
        password: form.get("password"),
        confirmation: form.get("confirmation"),
      }),
    });
    if (!response.ok) {
      setMessage(
        "Password update failed. Check that both values match and meet the password policy.",
      );
      return;
    }
    setUpdated(true);
    setMessage(
      "Password updated. All sessions were signed out. Sign in again and verify your authenticator.",
    );
    event.currentTarget.reset();
  }

  return (
    <>
      <form onSubmit={updatePassword}>
        <label>
          New password{" "}
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            maxLength={1024}
            required
          />
        </label>
        <label>
          Confirm new password{" "}
          <input
            name="confirmation"
            type="password"
            autoComplete="new-password"
            maxLength={1024}
            required
          />
        </label>
        <button type="submit" disabled={updated}>
          Update password
        </button>
      </form>
      <p aria-live="polite">{message}</p>
      {updated ? <a href="/admin/login">Return to administrator sign in</a> : null}
    </>
  );
}
