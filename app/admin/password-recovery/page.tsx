import { verifyAdminRecoveryGrant } from "@/lib/auth/admin-password-recovery.server";
import { requireAdminRequest } from "@/lib/auth/admin-request-guard.server";
import { createSupabaseSsrServerClient } from "@/lib/auth/supabase-ssr.server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { PasswordRecoveryForm } from "./password-recovery-form";

export const dynamic = "force-dynamic";

export default async function AdminPasswordRecoveryPage() {
  try {
    const client = await createSupabaseSsrServerClient();
    const requestHeaders = await headers();
    const request = new Request("https://recovery.invalid/admin/password-recovery", {
      headers: { cookie: requestHeaders.get("cookie") ?? "" },
    });
    const context = await requireAdminRequest(request, "read", { client });
    verifyAdminRecoveryGrant(request, context);
  } catch {
    redirect("/admin/login");
  }

  return (
    <main>
      <h1>Reset administrator password</h1>
      <p>
        Choose a new password. Successful update signs out every session and
        requires a fresh sign-in with authenticator verification.
      </p>
      <PasswordRecoveryForm />
    </main>
  );
}
