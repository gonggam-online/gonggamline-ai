# R3 Production rollout approval packet

## Decision requested

This packet requests a later, explicit Database / Security owner decision for
the ordered Production migration-history repair and Product security migration.
It does not itself authorize a database write.

Risk is high-risk/manual: Production migration history, schema, RLS, grants,
and authorization are affected. Auto-merge is prohibited.

## Exact target and repository head

- Supabase project: `sxvtznmoemrcwifungnb` (`main`, Production).
- Region: `ap-southeast-1`.
- Repository base: PR #64 merge
  `28b8877534c27b53b891b7b6507b2e18cc60a691`.
- Candidate migration: `023_product_security_target.sql`.
- Canonical LF SHA-256 from `supabase/baseline-manifest.json`:
  `c00f6e21d00e78fe112fd3d8369006b077daf49115b148392ae25481245126bd`.
- Pinned CLI: Supabase CLI `2.110.0`.
- Pinned local image digest:
  `sha256:13d9fe6fb6790d29c4f816b6cc14ec9271dc91a35f395c4315ecd09df5002128`.
- Approved 000-022 repair-plan fingerprint:
  `fc37b1402c76fce8b807b925b8d74d81e66b8665e39f38bbced912d6ee85b34c`.

## New verified backup

- Created: `2026-08-01T18:21:12.9036635+09:00`.
- Restricted local path (never commit or upload):
  `D:\Dev\backups\gonggamline-ai\2026-08-01-r3-production-pre-rollout-20260801-173300\r3-production-readonly-20260801.dump`.
- PostgreSQL format/version: PostgreSQL 17.6 custom archive.
- Size: `669804` bytes.
- SHA-256:
  `2BC389088AA1FB085039AF97B0A5FB927A2395A6BAF907C6078DB9C5D2F3C164`.
- Archive check: `pg_restore --list` passed with 1,247 TOC lines and database
  entries present.
- ACL: only `HA_ai\gongg`, `NT AUTHORITY\SYSTEM`, and
  `BUILTIN\Administrators`, all FullControl.
- Limitation: a logical dump does not prove global-role attributes. Any owner
  or role-attribute uncertainty remains a stop condition.

## Production read-only preflight

### 2026-08-03 fail-closed checkpoint

The first approved 023 application stopped in its initial precondition block,
before any DDL, RLS, Auth, or migration-history change. Follow-up read-only
inventory proved a previously unmodelled but bounded mixed pre-state:

- Product has the three classified restored public policies;
- `anon`, `authenticated`, and `service_role` each effectively have all seven
  Product table privileges, while PUBLIC has none; and
- all seven R1 functions already have the canonical restricted execute matrix.

The revised candidate accepts this exact Product matrix only with canonical
function ACLs. It does not accept partial function ACLs or canonical Product
state paired with permissive functions. Production retry remains prohibited
until the revised candidate passes every gate, is manually merged, and receives
a new explicit owner approval.

- Executed only through `BEGIN READ ONLY` and `ROLLBACK`.
- Raw restricted evidence:
  `D:\Dev\backups\gonggamline-ai\2026-08-01-r3-production-pre-rollout-20260801-173300\r3-production-readonly-preflight.csv`.
- Evidence size: `4584` bytes; rows: `24`.
- Evidence SHA-256:
  `DE6D2E2A68AC7DAF9D7FA8BEA23AE6DA104AB3C1FA8033A275C5568D2E5336C7`.
- Application migration history: `supabase_migrations.schema_migrations` is
  `ABSENT`.
- Public tables: `61`.
- Named 021/022 relations present: five.
- Named SECURITY DEFINER functions present: nine.
- Historical Product policies present: public read, insert, and update.
- Extensions present: `pg_stat_statements`, `pgcrypto`, `plpgsql`,
  `supabase_vault`, and `uuid-ossp`.
- Result: this bounded classification matches the approved R3 restore evidence.
  It does not waive the exact post-repair history, dry-run, or migration gates.

## Exact ordered command semantics

The approved runner must use only the pinned CLI image and repository head.
Secrets must be injected ephemerally as `SUPABASE_ACCESS_TOKEN` and
`SUPABASE_DB_PASSWORD`; neither value may appear in process arguments, files,
logs, chat, Git, PR text, or artifacts.

1. Link the workdir to exact project `sxvtznmoemrcwifungnb` using an approved
   short-lived Supabase access token. Confirm the resolved project before any
   database operation.
2. Run
   `supabase migration repair 000 001 002 003 004 005 006 007 008 009 010 011 012 013 014 015 016 017 018 019 020 021 022 --status applied --linked`
   with exactly 23 versions. Do not use `--all`; do not write history with SQL.
3. Run `supabase migration list --linked`. It must show exactly local/remote
   `000` through `022`, with no gap, addition, or timestamp rewrite.
4. Run `supabase db push --dry-run --linked`. It must list exactly
   `023_product_security_target.sql`; zero historical migration and zero other
   file may appear.
5. Stop and present the captured, secret-free dry-run output for a second
   explicit owner approval before applying 023.
6. Only after that approval, run `supabase db push --linked` without
   `--include-all`, `--include-roles`, or `--include-seed`.
7. Re-run migration list and read-only catalog classification. History must be
   exactly `000` through `023`; Product keeps intended anonymous SELECT only,
   anonymous INSERT/UPDATE are absent, and the accepted R1 function execute
   matrix/default privileges pass.

## Credential and transport blocker

This PC currently has no Supabase access token and no linked-project state.
The existing `gonggamline/r3-supabase-cli:2.110.0` entrypoint is deliberately
hard-coded to an isolated non-Production restore and must not be repurposed for
Production. An owner-approved Production runner must preserve the pinned binary
and use ephemeral environment variables with a writable tmpfs HOME. Creating a
Supabase personal access token, linking Production, and running the history
repair are separate high-risk external/database approvals.

## Maintenance window and monitoring

Owner approval must name the maintenance-window start/end in Asia/Seoul time.
During the window:

- freeze Product mutation commands before history repair;
- run history repair, list, and dry-run without schema changes;
- obtain the second explicit approval for the exact dry-run;
- apply 023 once;
- run read-only health/API/browser checks and watch Supabase database/API logs;
- stop on any connection spike, API 4xx/5xx increase, unexpected policy/grant,
  failed request, page error, or Product read regression.

No marketplace, order, inventory, settlement, supplier, or other commerce
write is permitted during verification.

## Rollback and stop conditions

Before 023 begins, metadata-only rollback is the official CLI command
`supabase migration repair 000 001 002 003 004 005 006 007 008 009 010 011 012 013 014 015 016 017 018 019 020 021 022 --status reverted --linked`,
followed by migration list and catalog comparison. This rollback also requires
explicit owner approval.

After 023 begins, do not revert migration history and never restore anonymous
Product writes. Stop traffic to affected Product mutation features and choose a
separately reviewed forward fix or incident restore from the verified backup.

Any unexpected backup hash, object, policy, grant, owner, function body,
search path, default ACL, migration version, CLI target, or dry-run output stops
the rollout.
