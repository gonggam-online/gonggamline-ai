# Item Selection finalization incident — 2026-08-04

## Scope and impact

- Production run: `715c4e8e-b1f9-48e5-9b98-62ec16ee2d8d`.
- Approved request: Domeggook keyword `텀블러`, size 10, no proposed sale price.
- The authenticated request passed fresh MFA and CSRF, created one immutable
  run/audit pair, and made exactly one provider list call.
- Vercel sanitized evidence recorded provider HTTP 2xx in 1,416 ms with no
  retry or detail fan-out, followed by HTTP 500 from the collection route.
- The run remained `RUNNING` with zero evaluations, one CREATE audit, and no
  Product, supplier, marketplace, order, inventory, fulfillment, settlement,
  or payment write.

No provider response body, credential, raw payload, personal data, or product
candidate data was captured for diagnosis.

## Root cause

Migration 021's `finalize_item_selection_run_v1` treats rows returned by
`unnest(p_evaluations)` as scalar composite values. Expressions such as
`(evaluation).original_position` therefore fail on PostgreSQL 17 with SQLSTATE
`42809`: column notation is applied to the first text attribute instead of the
expanded row alias. The provider call succeeds, but the atomic finalization
transaction never starts its inserts/update/audit and the route returns a
sanitized 500.

The previous gates verified workflow construction and database security
separately but did not call the finalizer through the actual Supabase RPC
serialization boundary. A disposable local RPC reproduction produced the same
`42809` and confirmed the gap.

## Forward fix

- Preserve migration 021 byte-for-byte.
- Migration 025 uses `CREATE OR REPLACE FUNCTION` with the identical signature,
  validation, locking, idempotency, atomic insert/update/audit, owner,
  `SECURITY DEFINER`, fixed search path, and service-role-only grants.
- Refer to expanded composite rows as `evaluation.attribute` and
  `submitted.attribute`; use the expanded `ordinality` column directly.
- Add a local-only RPC regression that creates one bounded synthetic run,
  finalizes 10 synthetic `MANUAL_REVIEW` evaluations, and requires exactly one
  CREATE plus one FINALIZE audit.

The disposable reproduction after migration 025 completed with 10 persisted
evaluations and two matching audits. Production migration 025 is not applied by
this PR and retains a separate owner approval boundary.

## Recovery and rollback

At `2026-08-04 05:57:11 UTC`, a read-only Production preflight found the
affected run 1,833 seconds old and eligible under the database-owned 30-minute
threshold. Under the owner's explicit one-time approval, migration 024 recovery
was invoked exactly once. It completed at `2026-08-04 05:57:30.942233 UTC` with
correlation `df0bcd0e-2c17-4377-b217-6cbd586dc8cc`.

The immediate compact postflight confirmed:

- run status `FAILED / STALE_RUN_RECOVERED`;
- zero observed, evaluated, persisted, failed, skipped, and stored evaluations;
- exactly one CREATE audit, zero FINALIZE audits, and one recovery audit;
- exactly one recovery audit for the approved correlation; and
- zero Production runs still `RUNNING` beyond 30 minutes.

Runtime health subsequently returned HTTP 200 with application, Supabase, and
runtime queue healthy. Overall status remained `degraded` only because the
pre-existing Coupang integration is unconfigured.

Rollback for migration 025 is application disablement or a separately reviewed
forward function replacement. Do not edit migration history, delete the run,
delete audits, or destructively restore the database.
