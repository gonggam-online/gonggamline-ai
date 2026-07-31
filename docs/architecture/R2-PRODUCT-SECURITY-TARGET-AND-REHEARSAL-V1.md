# R2 Product Security Target and Non-Production Rehearsal v1

## Status and authority

- Status: proposed Architecture Story; repository-owner acceptance through a manual merge is required.
- Owner: Product application with Database / Security persistence ownership.
- Risk: high-risk/manual because the later Story changes Product RLS, grants, and PostgreSQL default privileges. Apply `manual-merge-required`; never auto-merge.
- This Story changes documentation only. It does not authorize migration SQL, Supabase configuration, backup/restore, linked-project commands, Production, Auth changes, data writes, or commerce writes.
- Dependency: accepted R1 Atomic Product Mutation DB v1 and its merged runtime implementation. R2 implementation remains blocked until the exact deployed R1 migration and runtime are proved compatible in a restored non-Production environment.

## Objective and revenue impact

Remove anonymous Product mutation authority without breaking the intentional public catalog read or the protected Product command paths. This closes the highest-risk direct-write path around catalog, cost, profit, recommendation, operator, and competition fields while preserving the read surface used to find and evaluate saleable Products.

The smallest approved unit is the `public.products` security boundary only. Other access-matrix groups remain separate R1/R2 Stories.

## R1 compatibility re-audit

The repository at base `06476da312b5fc9f5c805bd7af19fc419565d9b8` contains these compatible boundaries:

| Consumer | R1 state | R2 dependency |
|---|---|---|
| `GET /api/domeggook-search` | provider read only; reports `savedCount: 0` | must remain persistence-free |
| `POST /api/admin/products/import` | guarded service-role `import_product_v1` | RPC execute and definer writes must pass |
| `PATCH /api/products/[id]` | guarded service-role operator-patch RPC | optimistic/idempotent RPC must pass |
| manual competition command | guarded service-role manual RPC | command and audit must pass |
| automatic/batch competition | protected trigger plus service-role RPC | per-item result and audit must pass |
| Product list query | shared anon client, `SELECT products.*` | intentional anon read must remain |

R1 is compatible in source, but source review is not deployment evidence. Before R2 SQL is generated, the restored environment must prove migration 022, all exact RPC signatures, function owners/search paths, service-role grants, the public Product read, and the five zero-anonymous-write application paths. Any source/deployed drift is a database or external-configuration blocker; do not compensate in application code.

`services/product-storage.service.ts` remains legacy source but no reachable R1 route may import or invoke `saveProducts`. A future import is a compatibility regression and blocks R2.

## Normative target state

### RLS and policies

- `public.products` has RLS enabled. `FORCE ROW LEVEL SECURITY` is not required for v1 because the approved mutation functions are owned by the controlled non-login database owner and execute as `SECURITY DEFINER`.
- Exactly one Data API policy remains: a permissive `SELECT` policy for `anon` with `USING (true)`, preserving the accepted public catalog-read contract.
- No `INSERT`, `UPDATE`, `DELETE`, or `ALL` Product policy exists for `anon`, `authenticated`, or `PUBLIC`.
- No policy may target an unconstrained role set or combine public read with a write command.
- Service-role mutation continues only through the four approved R1 RPCs; no direct browser write is introduced.

### Explicit grants

| Principal | SELECT | INSERT/UPDATE/DELETE/TRUNCATE | REFERENCES/TRIGGER |
|---|---:|---:|---:|
| `PUBLIC` | no | no | no |
| `anon` | yes | no | no |
| `authenticated` | no | no | no |
| `service_role` | yes | no explicit table-write grant required by the RPC contract | no |

R2 first revokes all Product privileges from `PUBLIC`, `anon`, and `authenticated`, and explicitly revokes `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, and `TRIGGER` from `service_role`. It then grants only `SELECT` to `anon` and `service_role`; the latter supports guarded R1 precondition/list reads. Mutation execute grants remain limited to the four exact R1 RPC signatures defined by migration 022. Helper RPCs remain denied to `service_role` and all browser-facing roles. No role receives Product sequence privileges.

### Default privileges

For every role that the restored inventory proves can create objects in `public` (at minimum the actual migration owner), the later forward migration sets owner-scoped default deny:

- revoke all default table privileges from `PUBLIC`, `anon`, and `authenticated`;
- revoke all default sequence privileges from those roles; and
- revoke all default function execute privileges from those roles.

Default privileges are owner-specific and affect only future objects. The migration generator uses the exact restored owner set; it must not assume `postgres` is the only creator. The deployment principal must be authorized to alter defaults for every inventoried creator role or the gate stops. Existing objects still require explicit revokes. Future service-role access is always an explicit per-object grant in the migration that creates the object.

## Forward-only migration design

The implementation Story may reserve the next unused identifier after the accepted migration head (currently `023_product_security_target.sql`). It must not create that file until this Architecture Story is accepted and the restore inventory passes.

The migration is one transaction and follows this order:

1. Assert the environment is non-Production during rehearsal outside SQL.
2. Assert `products`, RLS state, exact known Product policies, effective grants, object owners, default ACL owner set, and all R1 function signatures match the approved pre-state. Unknown or additional write authority aborts.
3. Revoke explicit Product privileges from browser-facing roles and direct Product write privileges from `service_role`.
4. Drop only inventory-confirmed anonymous write policies by exact identifier; never use broad dynamic policy deletion.
5. Enable Product RLS idempotently and create or replace the one exact anon `SELECT` policy.
6. Grant Product `SELECT` only to `anon` and `service_role`.
7. Reassert the exact R1 RPC execute matrix and helper-function denial.
8. Apply owner-specific default-privilege revokes for tables, sequences, and functions in `public`.
9. Run postconditions in the same deployment gate; any mismatch fails the release.

The migration is additive/forward-only even though it revokes authority. Never edit migrations 000-022 or migration history. Do not add a down migration that restores anonymous writes. Rollback is application-path disablement followed by a separately reviewed additive forward fix. Restoring a backup is an incident action, not ordinary rollback.

## Restore-based non-Production rehearsal

Use a new isolated Supabase non-Production project restored from a current Production backup or provider-approved sanitized clone. A local migration-only reset is useful but is not accepted as the restore rehearsal because it cannot prove deployed policy, grant, owner, default-ACL, or history drift.

### Preconditions and owner actions

- Repository owner selects the source backup and approves restore into an isolated non-Production project. Production is read-only to this Story.
- Record only backup timestamp/opaque restore job ID, target project ref, region, schema fingerprint, and row-count ranges. Never record database URLs, passwords, JWTs, service-role/anon keys, Auth tokens, customer data, or Product values.
- Target project has no marketplace credentials, webhooks, schedules, queues, outbound email, paid provider access, or Production domain.
- Use target-specific short-lived secrets in approved stores. Never copy Production application secrets merely because the database was restored.

### Rehearsal sequence

1. Restore and quarantine the target before attaching application code.
2. Capture migration-history, table/RLS/policy, relation/function ACL, function owner/search path, default ACL, extension, and row-count evidence.
3. Compare restored state with migrations 000-022 and the R0/R1 contracts.
4. Stop on missing 022, unknown Product policies/grants, owner mismatch, history divergence, unsafe extensions/hooks, or an unquarantined target.
5. Generate exact candidate 023 only from the accepted inventory; review its SQL and classified fingerprint.
6. Apply it once to the restored target, then re-run the complete inventory.
7. Prove anon Product `SELECT` succeeds and anon/authenticated Product writes and direct mutation RPC execution fail with zero effects.
8. With synthetic non-Production Admin/Auth fixtures, prove protected import, operator patch, manual competition, automatic competition, and bounded batch paths retain R1 response/idempotency/audit behavior.
9. Force Product, audit, and idempotency-completion failures and prove atomic rollback; prove search remains write-free.
10. Create representative future table/function/sequence objects under each inventoried creator role, verify browser-facing roles receive no defaults, and remove only those rehearsal fixtures.
11. Reapply the candidate to a freshly restored second target or fresh restore cycle and compare post-state fingerprints. Do not treat execution on an already-migrated database as replay evidence.
12. Run application contract/unit/integration tests, lint, typecheck, build, and authenticated Preview browser checks against the exact candidate head.

No rehearsal step may create a real Product, order, inventory, settlement, supplier, marketplace, or provider write. Synthetic Product rows are clearly namespaced and confined to the isolated target.

## Exact evidence and acceptance gates

Required artifacts are sanitized machine-readable pre/post inventories, classified schema fingerprints, migration output, negative privilege results, R1 RPC/atomicity results, default-privilege probe results, test logs, exact Git head, exact Preview deployment, console errors, and failed requests. Artifacts exclude row contents and secrets.

Implementation/Production remains blocked unless all are true:

- this Architecture Story is manually accepted and merged;
- R1 source and restored-deployment compatibility both pass;
- the restore is current, isolated, quarantined, and owner-approved;
- candidate SQL is derived from the exact restore inventory and reviewed;
- every negative role test proves zero Product effects;
- every R1 protected path and public read passes without contract drift;
- default privileges are proved for every inventoried object creator;
- CI and exact Preview pass at the candidate head; and
- a separate high-risk R2 implementation/Production Story receives explicit repository-owner approval, verified backup, maintenance/rollback plan, and `manual-merge-required`.

## Stop conditions, rollback, and remaining risk

Stop for missing/unknown backup provenance, a target connected to Production integrations, migration-history drift, unknown Product policy/grant/default ACL, absent R1 functions, mismatched owner/search path, public read regression, any anonymous write success, partial RPC effects, or unsanitized evidence.

The Architecture Story rollback is a documentation revert. A later rehearsal rollback destroys or quarantines only the explicitly approved non-Production target under owner/provider procedure. A later applied database change is forward-fixed; anonymous writes are never restored as a shortcut.

Residual risk remains in provider restore fidelity, owner-specific default ACL drift, service-role bypass scope, public exposure of all selected Product columns, concurrent writes during a future Production rollout, and unapplied or divergent migration history. Production reconciliation is a separate R3 decision and is not authorized here.
