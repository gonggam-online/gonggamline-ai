# R3 Migration History Reconciliation v1

## Status, authority, and risk

- Status: proposed Architecture Story; repository-owner manual acceptance is
  required.
- Owner: Database / Security.
- Risk: high-risk/manual because later execution mutates Supabase migration
  history and gates a Production RLS migration.
- Authorized in this Story: repository and restored-catalog read-only
  discovery, architecture, runbook design, tests, Draft PR, and Preview.
- Not authorized: `migration repair`, `db push`, schema/RLS changes, direct
  writes to `supabase_migrations`, Production configuration, or PR merge.

## Problem and business objective

Production contains the application schema and the R1 objects required by the
current runtime, but the current logical archive and its isolated restore have
no `supabase_migrations` schema or `schema_migrations` relation. R2 correctly
refuses to generate migration 023 without exact 000-022 history. The previous
ordering also placed history repair after R2, creating a circular gate: R2
requires history, while history repair was waiting for R2.

The objective is to adopt canonical migration metadata without replaying
historical DDL, certifying unknown drift, or weakening Product security. This
unblocks a separately approved R2 rehearsal while protecting Production from a
`db push` that could otherwise attempt migrations 000-022.

## Evidence identity and limitations

### Repository source of truth

- `supabase/baseline-manifest.json` pins 23 contiguous migrations, 000-022,
  with canonical LF SHA-256 values.
- Existing accepted Production classification proves the 57 public tables and
  schema groups represented by 000-020 were deployed, with separately
  classified permissive-policy and grant drift.
- Migrations 000-022 remain immutable. R3 never edits their SQL or hashes.

### Current restored evidence

- Source archive:
  `r2-production-readonly-20260801-101257.dump` (outside Git).
- Archive SHA-256:
  `E3EB20E15E481C5A959978E2AE18E972088E3E263019F50F943AF15CF3AF6FDB`.
- Archive: PostgreSQL 17.6 custom format, 669,804 bytes, 1,232 listed entries.
- Target: local container `r2-rehearsal-db-0328e62`, volume
  `r2_rehearsal_db_0328e62`, Docker network `none`, no published ports.
- Sanitized R3 catalog evidence SHA-256:
  `3D229F91017856443390B669BE3F89C01D3409A2B98E248BEEAAFCCA64D0FA9B`.
- Observed: 61 public tables; all 021/022 named relations and nine named
  SECURITY DEFINER functions are present; Product retains the three historical
  anonymous policies; application migration history is absent.
- Restore limitation: `pg_dump` excludes global role definitions. The archive
  referenced one owner absent from the local image,
  `supabase_realtime_admin`; the restore synthesized it as a `NOLOGIN` role.
  Therefore role-attribute equivalence is not proved by this restore.
- Evidence contains catalog metadata only. Raw rows, credentials, URLs, keys,
  and Product values are excluded from Git and PR text.

## Migration classification model

History repair is not schema repair. Each version receives two independent
classifications:

1. **DDL contract**: `EXACT`, `COMPATIBLE`, `INCOMPATIBLE`, `ABSENT`, or
   `DEFERRED`.
2. **Security delta**: `NONE`, `CLASSIFIED_FORWARD_FIX`, or `BLOCKED`.

Only `EXACT` or explicitly approved `COMPATIBLE` DDL may be marked applied.
Every difference must be enumerated; absence of a migration-history row is not
evidence that its DDL is absent, and object presence alone is not exact body,
constraint, ACL, or owner proof.

| Versions | Current classification | Required execution-time proof |
|---|---|---|
| 000-020 | Existing accepted evidence: deployed schema groups are `EXACT`; permissive policy/grant differences are `CLASSIFIED_FORWARD_FIX` | Re-run full catalog fingerprint against the new backup and canonical manifest; no new or unknown difference |
| 021 | `COMPATIBLE` presence: three protected relations and both named SECURITY DEFINER functions are present; exact constraints, type, bodies, ACLs, and owner attributes remain execution-gated | Exact catalog fingerprint for every 021 object and privilege postcondition |
| 022 | `COMPATIBLE` presence: mutation relation and seven named SECURITY DEFINER functions are present; exact bodies, constraints, ACLs, and owner attributes remain execution-gated | Exact catalog fingerprint for every 022 object, function, and execute matrix |
| history | `ABSENT` | Official CLI creates/repairs only the approved 000-022 versions |

No current classification authorizes repair. An implementation Story must
produce a deterministic machine-readable 000-022 comparison and stop on every
`INCOMPATIBLE`, `ABSENT`, `DEFERRED`, or unknown result.

## Resolved delivery ordering

The following ordering supersedes the circular “R2 before all R3 history
repair” interpretation while preserving separate approvals:

1. **R3 architecture/discovery**: this Story; no database writes.
2. **R3 rehearsal implementation**: on a fresh isolated restore, prove the
   complete 000-022 catalog, then use the official Supabase CLI to mark exactly
   000-022 applied on that isolated target only.
3. Re-run migration history and full catalog fingerprints. `db push --dry-run`
   must report no historical DDL and no unapproved migration.
4. **R2 implementation**: only after the isolated repaired-history inventory
   passes, derive candidate 023 from the exact policy/grant/owner/default-ACL
   inventory and complete the R2 negative/replay rehearsal.
5. **Production proposal**: take a new verified backup and repeat the complete
   read-only comparison against the exact candidate head.
6. In one separately approved maintenance window, use official
   `supabase migration repair ... --status applied` for exactly 000-022.
7. Immediately run `supabase migration list` and `supabase db push --dry-run`.
   The dry run must list only the exact approved 023 artifact. Any other output
   stops the rollout before schema change.
8. Apply 023 only under its separate Production approval, then run history,
   catalog, application, and browser verification.

The official CLI documents that `migration repair --status applied` inserts a
history record and `--status reverted` removes it. Direct SQL against
`supabase_migrations.schema_migrations` is permanently prohibited.

## Security and failure handling

- Never replay 000-022 against Production to manufacture history.
- Never use `db reset --linked` on Production.
- Never use `db push` until dry-run output is exact and approved.
- Never treat Production-only permissive policies as canonical migration
  content. They remain classified drift for forward-only R2 remediation.
- Never restore anonymous writes as rollback.
- Stop for an unexpected object, policy, grant, owner, function body, search
  path, default ACL, migration version, CLI plan, or backup fingerprint.
- Keep credentials in an approved local prompt/secret store; never include a
  password or database URL in arguments, artifacts, Git, or chat.

## Rehearsal gates

The later R3 rehearsal implementation must prove all of the following on two
fresh restore cycles:

1. backup fingerprint and quarantine controls match the approved target;
2. 000-022 immutable manifest hashes pass;
3. every version has deterministic object-level evidence;
4. repair uses the pinned, reviewed Supabase CLI version;
5. repaired history is exactly 000-022 with no gap or addition;
6. pre/post catalog fingerprints are identical except for migration metadata;
7. dry-run lists no historical DDL and no unapproved migration;
8. repeated rehearsal yields the same history and catalog fingerprints;
9. failure injection stops without schema or Product-row effects; and
10. sanitized evidence contains no secrets or business row values.

## Production gates and rollback

Production execution requires a new exact-target approval containing the new
backup hash, database project ref, CLI version, exact versions, command plan,
dry-run expectation, maintenance window, monitoring, and rollback.

Before 023 is applied, history-only rollback uses only the official CLI to mark
the same approved versions reverted, followed by a history list and catalog
comparison. If 023 has begun or any schema postcondition is uncertain, stop and
use a separately reviewed forward fix or incident restore. No rollback may
reintroduce anonymous Product writes.

## Alternatives rejected

- Manual `INSERT` into `schema_migrations`: bypasses CLI validation and audit.
- Blindly marking all repository files applied: certifies unproved 021/022
  details and unknown drift.
- Replaying 000-022 in Production: duplicate-object, data, function, policy,
  and trigger risk.
- Generating 023 before history reconciliation rehearsal: violates the R2
  fail-closed inventory contract.
- Treating a local migration-only reset as deployed evidence: cannot prove
  Production drift or restore fidelity.

## Acceptance and non-goals

Acceptance approves this ordering and later implementation design only. It
does not approve a CLI repair command, linked project, Production mutation,
candidate 023, RLS change, merge of PR #64, or commerce write. Each later
high-risk database action retains exact-target approval and manual merge.

## Official references

- [Supabase CLI reference](https://supabase.com/docs/reference/cli/supabase-projects-create)
  documents `migration repair`, its applied/reverted history effects, and
  `db push --dry-run`.
- [Supabase CLI local-development workflows](https://supabase.com/docs/guides/local-development/cli-workflows)
  describes the intended migration workflow and linked-project safeguards.
