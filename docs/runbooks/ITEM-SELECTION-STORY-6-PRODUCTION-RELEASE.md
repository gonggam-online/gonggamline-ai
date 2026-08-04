# Item Selection Story 6 Production release

## Status and authority

- Status: `PREPARED — OWNER APPROVAL REQUIRED`.
- Risk: high-risk/manual because the release applies Production migration 024
  and the optional live smoke creates immutable Item Selection history.
- Exact application base: Story 5 merge
  `09b1bd3973a5f4cc35b20a83ada1b2575781c1e4`.
- Production application: `https://gonggamline-ai.vercel.app`.
- Production database baseline asserted by the Stage 7 handoff: migrations
  000–023 applied; migration 024 not applied. Reconfirm this from the linked
  target immediately before any write.
- Candidate: `supabase/migrations/024_item_selection_stale_recovery.sql`.
- Canonical LF SHA-256:
  `91db6288ffb64261a92cb9524cd33bec907b484b1a4e9ce05c7bf574a059fb5a`.

This runbook records an execution boundary; it does not authorize a database,
configuration, Auth, commerce, or Production write. The repository owner must
approve the exact target, maintenance window, backup evidence, dry-run output,
bounded live-smoke write, and manual merge/deployment transition where each is
applicable. Secrets, tokens, user UUIDs, cookies, raw provider payloads, and
database rows must never enter chat, Git, logs, screenshots, or artifacts.

## Stories 1–5 exact gates

| Story | PR | Final head | Merge | Exact CI | Exact Preview browser |
| --- | --- | --- | --- | --- | --- |
| 1 evaluator | #36 | `2ee7693dc664d3eeafabccc258135450dbaa5d45` | `04508f033892d57cab29c3430231d29424c36fa2` | `30261985279` success | `30261985272` success |
| 2 profitability | #37 | `02d1653f119457ee8fd376e740973bb2b414f734` | `7491b239f5935643778330a08ed4b070511c4c7a` | `30316002427` success | `30316002398` success |
| 3 persistence | #72 | `2a3a6a21dd6b65a76d0017e832b0029ca896f845` | `bfd7b9a3c561d8eecbf4814e7ad5d59bdaf9ccde` | `30788369690` success | `30788369691` success |
| 4 workflow/API | #73 | `83c3b55a2159f827f6f4e05579648e7639854dc6` | `fdcc08d7cb7ad57607229357dc008f2ec37d33aa` | `30791722721` success | `30791722722` success |
| 5 Admin UI | #74 | `6565625e8863ffe811319f77b2ad21bb24268506` | `09b1bd3973a5f4cc35b20a83ada1b2575781c1e4` | `30793385771` success | `30793385752` success |

Every row was re-read from GitHub on 2026-08-03. A new commit on any dependency
requires re-running its applicable gates; do not transfer a prior run to a new
SHA.

## Mandatory stop conditions

Stop before the first write if any of these is unknown or differs:

- linked Supabase project is not the approved Production project;
- migration history is not exactly 000–023 before application;
- canonical manifest 000–024 has any hash mismatch;
- 024 dry-run lists anything other than
  `024_item_selection_stale_recovery.sql`;
- latest restorable backup, restore-check evidence, owner, window, RPO, or RTO
  is absent or unapproved;
- the expected 021 Item Selection tables, RLS, grants, functions, constraints,
  or 023 Product security target differ;
- application exact-head CI, Preview, or non-destructive browser checks fail;
- Production Admin AAL2, allowlist, CSRF, allowed origin, service-role scope,
  provider configuration, or monitoring is unavailable;
- the instance-local rate limiter is judged unacceptable for the intended
  topology;
- any secret/raw payload would be captured, or any bulk crawl, Product,
  marketplace, supplier, order, inventory, settlement, or payment write could
  occur.

Do not repair drift in application code. Classify it as external configuration
or database state and stop for a separately reviewed plan.

## Approved migration sequence

All commands use the repository-pinned Supabase CLI and ephemeral credentials.
No token or password may be placed in a command argument or persisted file.

1. Freeze Item Selection mutation use for the named maintenance window.
2. Verify the new backup and isolated restore-check evidence approved for this
   window. A historical backup is not sufficient by itself.
3. Link only the approved Production project and print a secret-free target
   identity check.
4. Run `supabase migration list --linked`; require exact 000–023 parity.
5. Recompute canonical LF hashes for repository migrations 000–024 and require
   exact `supabase/baseline-manifest.json` parity.
6. Run `supabase db push --dry-run --linked`; require exactly migration 024.
7. Stop and obtain owner approval for the captured secret-free dry-run.
8. Run `supabase db push --linked` once, without seeds, roles, `--include-all`,
   history SQL, or manual metadata edits.
9. Re-run migration list; require exact 000–024 parity.
10. In a read-only transaction, verify the 024 function signature, owner,
    `SECURITY DEFINER`, fixed search path, service-role-only execute grant, the
    expanded audit constraints, and unchanged protected-table RLS/grants.
11. Validate application health and the fail-closed unauthenticated Admin route
    before considering the optional live smoke.

If application of 024 fails, do not retry blindly. Capture only sanitized error
class, confirm transaction/catalog/history state read-only, and choose a
reviewed forward fix.

## Bounded live smoke

Fixture browser validation is mandatory and precedes live use. The live smoke
is a separate owner-approved Production/database/provider write and is limited
to one administrator, one fresh AAL2 session, one keyword approved at execution
time, and size `10`.

The operator must use `/admin/item-selection`; no direct RPC, client-authored
finalize payload, bulk crawl, detail fan-out, retry loop, Product creation, or
commerce write is allowed. Record only sanitized counts, terminal status,
latency, HTTP status, correlation identifier, and whether exactly one create
and one finalize audit event exist. Never record candidate details, raw
provider material, cookies, tokens, UUIDs, or stored snapshots.

Acceptance:

- one provider list call and no detail fan-out;
- one new run reaches `COMPLETED`, `PARTIAL`, or sanitized `FAILED`;
- observed count is at most 10 and persisted evaluations are at most 10;
- immutable run/evaluation counts and audit cardinality agree;
- unknown rights or economics remain `MANUAL_REVIEW`, never inferred pass;
- no unexpected 4xx/5xx, page error, `console.error`, failed request, raw stack,
  or secret/raw payload exposure;
- no Product or external commerce table/API mutation.

Do not run a second live attempt to make a failed release look healthy. A retry
requires a new explicit decision and must use the existing retry linkage.

## Health, metrics, and release evidence

Before and after migration, and for 30 minutes after the approved live smoke,
record only aggregate/sanitized evidence:

- Vercel deployment SHA/status and `/admin/item-selection` HTTP/render health;
- protected API unauthenticated fail-close status and `Cache-Control` behavior;
- Supabase database/API availability, connection/error signals, and unexpected
  4xx/5xx trend;
- Item Selection terminal-status aggregate, stale `RUNNING` aggregate older
  than 30 minutes, run latency, persisted-evaluation aggregate, and matching
  audit aggregate for the bounded window;
- browser page errors, unexpected console errors, and failed requests;
- Product/marketplace/supplier/order/inventory/settlement/payment write count
  remains zero for this verification.

Thresholds are fail-closed: any unexpected error, mismatched count, stale run,
or forbidden write stops release completion and invokes rollback/incident
handling. This runbook does not invent alert thresholds absent from the
approved monitoring source.

## Rollback and recovery

Before 024 begins, rollback is cancellation: leave Production at 000–023 and
redeploy nothing. After 024 commits, never delete immutable Item Selection
history, rewrite old migrations, manually edit migration metadata, drop the
additive function, or restore broad access as an unreviewed rollback.

Application rollback disables the Item Selection UI/API/caller, redeploys the
last known-good application SHA through the normal reviewed path, and preserves
migrations 021/024 plus all run/evaluation/audit history. Database failure uses
a separately approved forward fix or incident restore from the verified backup.
Any destructive restore, migration-history change, or traffic/configuration
change requires its own Production approval.

## Completion record

Keep this section `PENDING` until every binding gate and approval passes.

- Stage 08 PR/head: Draft PR #75; rollout evidence head
  `bbf1216136a823ea87dc633f00151490d15b0d42`; manual merge remains required
- exact CI / Preview browser / Vercel Preview: rollout evidence head passed CI
  run `30871404485` after one same-head failed-job rerun, Preview browser run
  `30871404499`, and Vercel Preview
- owner approvals and maintenance window: steps 1–7 and the one-time step 8
  apply were explicitly approved; 2026-08-04 10:31:55–11:31:55 Asia/Seoul
  window completed without a rollback trigger; live smoke and PR merge remain
  separate approval boundaries
- backup and restore check: PASS — PostgreSQL 17.6 custom archive created at
  2026-08-04 01:35:16 UTC, 696,310 bytes, SHA-256
  `258ECE476C284B3AA0C5215E27DA3FCDF827E1417B389C8E293383D383E1533F`;
  1,241-entry TOC and full `/dev/null` archive extraction passed; backup remains
  outside Git under the approved restricted backup root
- migration preflight/dry-run/apply/postflight: PASS — target
  `sxvtznmoemrcwifungnb`; 000–023 Local/Remote parity PASS; manifest 25/25
  PASS; dry-run listed only `024_item_selection_stale_recovery.sql`, with no
  seeds or roles; owner approved one-time apply; CLI 2.110.0 applied it once;
  post-list is 000–024 parity and read-only catalog verification passed owner,
  SECURITY DEFINER, fixed search path, grants, and audit constraints
- fixture smoke / bounded live smoke: PENDING
- Production deployment SHA and health: existing Story 5 Production application
  remains deployed; `/admin/item-selection` rendered the authenticated form and
  empty history with zero console warning/errors; runtime health was HTTP 200,
  application/Supabase/runtime queue healthy, overall `degraded` only because
  Coupang is unconfigured; no application redeploy was required for additive 024
- 30-minute metrics observation: PASS — seven 5-minute samples from
  10:46–11:16 Asia/Seoul; every sample returned health success, total runs 0,
  and stale RUNNING 0
- rollback check: PASS — no threshold fired, so no rollback action was invoked;
  verified backup and preservation-first rollback remain available
- remaining risks: instance-local rate limiter; live provider variability;
  immutable Production history created by an approved smoke; unauthenticated
  Admin error responses currently use Vercel `public, max-age=0,
  must-revalidate` instead of explicit `no-store`; live smoke and PR manual
  merge remain pending separate owner approval. Final CI run `30871404485` had
  one unrelated Orchestrator shutdown-timing failure on its first ci-tests
  attempt; the same-head failed-job rerun passed 427/427 without a code change.
