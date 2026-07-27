# Sprint A completion report

## Objectives

Sprint A recovered the missing pre-003 Supabase baseline, preserved original
SQL Editor evidence, inspected deployed Production state, reconciled expected
objects, and finalized safe fresh-replay, Production, migration-history, and RLS
strategies without executing SQL.

## Evidence collected

- Products baseline and Product workflow SQL.
- Commerce OS core, check, historical development RLS, and verification SQL.
- Existing migrations 003–020.
- Thirteen authoritative Production inspection CSV files with recorded hashes.
- Application access inventory and all recovery/reconciliation documents from
  PRs #26–#29.

## Recovery source

All operator SQL remains verbatim under `supabase/recovery-sources/`. Diagnostic
and verification entries are separated from DDL candidates. Historical
`003_dev_rls` remains evidence only and is rejected as a Production policy.

## Inspection summary

Production evidence reports:

- 57 expected public tables;
- 883 columns;
- 268 constraints;
- 148 indexes;
- 59 policies;
- Product plus 50 Git-chain tables with RLS enabled;
- four recovered Commerce OS triggers; and
- required `pgcrypto`.

The Product schema, Product workflow, Commerce OS tables, migrations 003–020,
indexes, constraints, policies, triggers, and extension are reconciled.

## Classification summary

- Schema objects: `EXACT`, except the deployed function contract is
  `COMPATIBLE` and its body comparison is `DEFERRED`.
- Historical permissive policies: `EXACT` as history and `INCOMPATIBLE` with
  Production least privilege.
- Commerce OS historical RLS enabled/forced state: `DEFERRED` because the
  multi-result export omitted that grid.
- Application migration metadata: `ABSENT` within inspected visibility;
  subsystem metadata is `COMPATIBLE` only with its owning subsystem.
- Chronology and runner-format evidence: `DEFERRED` to canonical generation and
  execution boundaries.

No unresolved `UNKNOWN` finding remains.

## Migration strategy

Fresh databases will use a canonical dependency order:

1. Products baseline.
2. Product workflow.
3. Commerce OS core.
4. New Production-safe RLS baseline.
5. Existing migration 003.
6. Existing migrations 004–020.

Future filenames express canonical dependency order, not unverifiable
historical timestamps. Existing migrations are never renamed.

Existing Production does not replay baseline DDL. It receives only deliberate
forward corrective/security migrations after Preview/Staging rehearsal.

## Migration-history strategy

Never manually `INSERT` into `schema_migrations`. Fresh databases use the
official Supabase migration workflow. Existing Production may later use an
officially supported repair/baseline operation for independently proven
versions, or begin at a documented forward-only adoption boundary if safe
stamping is unavailable.

Auth, Realtime, and Storage metadata tables are never reused for application
history.

## Production strategy

The identity boundary changes before policy restriction. The immediate target
is no anonymous writes, explicitly public reads only, and authenticated or
server-mediated business operations. Long-term policies require verified
owner/tenant keys and scoped worker privileges.

No Production change is authorized by Sprint A.

## Known limitations and deferred items

1. Deployed `set_updated_at()` body comparison: deferred until a Production
   function change is proposed.
2. Commerce OS historical RLS state: deferred; the future policy migration
   explicitly establishes desired state.
3. Historical SQL Editor timestamps: deferred because canonical dependency
   replay is sufficient.
4. Runner metadata/checksum format: deferred until migration files are
   generated and official adoption is executed.
5. Preview/Staging parity: required before future Production database changes,
   not for Sprint A close-out.
6. Concrete identity/ownership implementation: deferred to the Production RLS
   execution Story.

## Lessons learned

- `IF NOT EXISTS` proves neither compatibility nor safe replay.
- SQL Editor history and repository migration history are separate evidence.
- Historical fidelity and current security must be classified independently.
- Multi-result SQL Editor exports must preserve every result grid.
- Migration-history repair is not schema repair and never justifies manual
  metadata inserts.
- A canonical dependency history is sufficient when exact historical
  timestamps are unavailable and Production is reconciled forward-only.

## Formal declaration

**Sprint A Complete with Deferred Items**

Recovery evidence, Production inspection, classification, canonical replay,
Production reconciliation, migration-history adoption, and RLS strategy are
complete at the design/evidence level. Every unverifiable item has a justified
deferred boundary, owner, mitigation, and later verification point.

Recommendation: close Sprint A and begin Sprint B with the read-only Domeggook
Live Search Vertical Slice. Do not combine Sprint B with migration generation
or Production RLS execution.
