# Listing creative storage rollout v1

## Scope and stop conditions

This runbook configures the accepted private-master/public-mirror boundary after
the exact high-risk implementation PR is manually merged. It does not authorize
an image-provider call, a public generation route, a marketplace write, or use
of a generated artifact. Stop if the target project, access level, MIME limit,
token environment, object digest, or operator identity cannot be verified.

Never copy `SUPABASE_SERVICE_ROLE_KEY`, `BLOB_READ_WRITE_TOKEN`, or an OIDC
token into chat, screenshots, logs, Git, a client bundle, or a Preview environment.

## 2026-08-14 exact-project rollout result

The post-PR-134 authenticated rollout established the following exact state:

- Supabase bucket `listing-creative-private-v1` exists with public access off,
  the approved 20 MiB/MIME limits, and zero `anon`/`authenticated` policies;
- public Vercel Blob store `listing-creative-public-v1` exists in `ICN1` (Seoul)
  and is connected with `BLOB_STORE_ID` plus `BLOB_WEBHOOK_PUBLIC_KEY`;
- the connection uses Vercel's current OIDC default. No long-lived
  `BLOB_READ_WRITE_TOKEN` was added, revealed, or copied;
- the store identifier is present in Production and Preview, but the application
  storage composition rejects every non-Production `VERCEL_ENV` before the SDK;
- a default payment method is present, but the authenticated Billing page still
  labels the team `Pro Trial`, shows expiry `00:00:00`, disables on-demand budget
  configuration, and requires `End Trial and Start Pro Plan`. Paid Pro
  continuity remains an operational blocker before relying on the mirror for
  sales. Do not interpret the separate Vercel AI Gateway credit as Blob or
  OpenAI Image API billing authority.

Vercel's 2026-06-01 official OIDC announcement states that new Blob connections
default to short-lived, automatically rotated OIDC credentials and no longer
need a long-lived read-write token. `@vercel/blob@2.8.0` resolves that credential
from the Production request context and `BLOB_STORE_ID`. Observed 2026-08-14;
scope is Vercel-hosted Functions only, so legacy-token fallback remains available
for an explicitly controlled non-OIDC migration, never Preview.

## 1. Supabase private master

1. Open the existing GonggamLine managed Supabase project, then **Storage**.
2. Create bucket `listing-creative-private-v1` with **Public bucket disabled**,
   a `20 MiB` file limit, and only `image/png`, `image/jpeg`, `image/webp`, and
   `application/json` MIME types. `supabase/config.toml` is the reproducible
   source configuration; do not insert or mutate `storage` schema rows directly.
3. In **Storage > Policies**, verify there is no `anon` or `authenticated`
   `SELECT`, `INSERT`, `UPDATE`, or `DELETE` policy that admits this bucket.
   Default deny is intentional. The server service role bypasses RLS and must be
   available only to the authenticated Production server boundary.
4. Verify the bucket is not public, an anonymous object URL fails, and a
   short-lived signed URL succeeds only for a synthetic disposable fixture.

## 2. Vercel public mirror

1. Open the GonggamLine Vercel project, then **Storage > Create Database > Blob**.
2. Create a **Public** Blob store named `listing-creative-public-v1` in `ICN1`.
3. Prefer the current OIDC connection. Verify `BLOB_STORE_ID` exists and no
   long-lived `BLOB_READ_WRITE_TOKEN` is required. Although Vercel exposes the
   non-secret store identifier to Production and Preview, application code must
   reject non-Production execution before any write. Do not create a
   `NEXT_PUBLIC_*` credential or reveal an OIDC token.
4. Keep SDK object writes immutable: `addRandomSuffix=false` because the path is
   already SHA-256 content-addressed, and `allowOverwrite=false`.
5. Before the first product publication, verify the Billing page no longer says
   `Pro Trial`, the paid Pro billing cycle is active, spend management can be
   configured, and the default payment method remains valid. Merely storing a
   payment method or seeing AI Gateway credit does not close this gate.

## 3. Synthetic restore drill

Use a non-product synthetic PNG and an authenticated operator context only.

1. Reserve its deterministic job digest once; an identical second reservation
   must return `DUPLICATE_GENERATION_RESERVATION` before any provider call.
2. Archive the bytes under
   `v1/<subjectHash>/<revisionDigest>/<role>/<sha256>.<ext>` and download them
   from the private origin. The downloaded SHA-256 must match the descriptor.
3. Create a signed review URL with an expiry between 60 and 3,600 seconds and
   verify the private bucket still has no anonymous access.
4. Bind a synthetic content approval to the candidate, revision, and exact
   artifact digest. Publish to Blob and verify both origin and CDN reads match
   the private digest.
5. Takedown the public mirror and verify origin and CDN reads are absent. A stale
   cache must remain `TAKEDOWN_PENDING`, never successful.
6. Restore the same digest from the private master, verify both reads again,
   then remove the disposable public fixture. Retain only sanitized manifest
   evidence; never retain a local-only copy as the recovery source.

## Rollback and recovery

Stop dispatch, remove the public mirror first, rotate the Blob token on suspected
exposure, preserve the private master subject to retention/legal hold, and revert
the implementation commit. Public delivery is rebuilt only from a verified
private digest and a new digest-bound content approval. Live-write approval is a
separate boundary and is never implied by storage publication.
