# Supabase baseline implementation plan

## Executive decision

Production already contains all 57 expected public tables and the schema
objects recoverable from Product, Commerce OS, and migrations 003–020.
Historical baseline DDL must not be replayed against Production.

The schema-restoration problem is now two separate problems:

1. establish a canonical fresh-database migration history; and
2. replace historically accurate but unsafe Production RLS without disrupting
   an application that currently uses the anon role.

Migration files are not created in Sprint A. The canonical design is finalized;
execution-sensitive verification is deferred to later migration-generation and
Production-security Stories.

## Source and classification summary

| Source | Deployed schema | Production security |
|---|---|---|
| Products baseline | EXACT | Three policies INCOMPATIBLE |
| Product workflow | EXACT | Not applicable |
| Commerce OS core | EXACT; function contract COMPATIBLE and body comparison DEFERRED | Historical RLS state DEFERRED |
| Historical `003_dev_rls` | Six policies EXACT historically | INCOMPATIBLE |
| Competition 003–004 | EXACT | Depends on unsafe Product access |
| Market 005–009 | EXACT | 18 policies INCOMPATIBLE |
| Supplier 010 | EXACT | 3 policies INCOMPATIBLE |
| Workflow/Procurement/Listing/Coupang 011–014 | EXACT | 13 policies INCOMPATIBLE |
| AI Decision/Company OS 015–018 | EXACT | 12 policies INCOMPATIBLE |
| Revenue/Runtime 019–020 | EXACT | 4 policies INCOMPATIBLE |

Details and CSV hashes are in
`docs/SUPABASE_DEPLOYED_OBJECT_CLASSIFICATION.md`.

## Fresh database replay

### Logical order

The dependency-safe order is:

1. Products baseline.
2. Product workflow extension.
3. Commerce OS core schema. It may precede Product workflow technically, but
   its exact historical relative order remains unproven.
4. A new Production-safe RLS baseline; never historical `003_dev_rls`.
5. Existing `003_coupang_competition_analysis.sql`.
6. Existing migrations 004–020 in their current order.

Verification-only SQL Editor entries remain outside migrations.

### Final official layout design

Historical timestamps are not required. Future filenames encode canonical
dependency order, not original execution chronology. Existing 003–020 remain
unchanged. Exact filenames are assigned only in the separately approved
migration-generation Story:

| Logical slot | Candidate | Decision required |
|---|---|---|
| pre-003 A | Products baseline | Authoritative filename/version |
| pre-003 B | Product workflow | Canonical dependency slot |
| pre-003 C | Commerce OS core | Canonical dependency slot; recovered function body |
| security baseline | Production RLS | Identity/ownership policy approval |
| existing chain | 003–020 | Never rename |

This is sufficient because fresh databases have no historical state and
Production never replays the baseline files.

### Replay acceptance

Rehearse only in a disposable isolated project. Require zero statement errors,
all expected fingerprints, RLS negative tests, seed verification without
business-data leakage, generated schema cache, and application/browser gates.

## Existing Production recovery

### Schema treatment

- EXACT objects: preserve; do not rerun their historical DDL.
- COMPATIBLE subsystem metadata: leave under its owning Supabase subsystem.
- INCOMPATIBLE security objects: replace only through an approved RLS migration.
- ABSENT application migration metadata: do not synthesize rows.
- DEFERRED historical properties: verify at a future execution boundary and
  never use them to justify Production baseline replay.

No additive schema migration is currently justified by the Production CSVs.
Any later difference must receive a narrowly scoped corrective migration after
020; it must not be hidden inside a baseline file.

### Production execution sequence

1. Close remaining catalog evidence gaps.
2. Establish Preview/Staging parity.
3. Introduce the approved application identity boundary.
4. Apply and verify least-privilege policies in Preview/Staging.
5. Approve rollback and Production window.
6. Apply only the reviewed RLS/corrective migration.
7. Re-run all thirteen catalog inspections plus authorization/browser tests.

## Migration history recovery

Production evidence does not expose
`supabase_migrations.schema_migrations`. Auth, Realtime, and Storage metadata
relations exist but belong to their subsystems and must not be repurposed.

Replay is neither necessary nor safe for Production because the schema and
approximately 151 Product rows already exist. Blind replay could overwrite the
updated-at function, recreate constraints, collide with policies, or modify
seed state.

The official adoption strategy is:

- fresh databases run the canonical repository chain through the
  Supabase-supported migration workflow;
- existing Production is never backfilled with manual metadata statements;
- after canonical files exist, an approved execution Story may use the
  official Supabase migration-history repair/baseline capability to mark only
  independently proven applied versions;
- if the official workflow cannot represent deployed state safely, Production
  remains unstamped and future changes begin at a documented forward-only
  adoption boundary.

Before any stamping operation:

1. identify the runner and version/checksum/name rules;
2. prove its actual metadata relation and visibility;
3. map each canonical migration to deployed exact objects;
4. rehearse its official repair mechanism outside Production;
5. obtain database-owner approval.

Never manually `INSERT` into `schema_migrations`, and never reuse Auth,
Realtime, or Storage migration tables.

## Production security recovery

The security recovery is a separate high-risk change described in
`docs/PRODUCTION_RLS_REPLACEMENT_PLAN.md`. Historical policies stay preserved
as evidence but are not the target state.

The immediate target is no anonymous writes, explicitly public anonymous reads
only, and authenticated/server-mediated business operations. The long-term
target adds verified owner/tenant keys and scoped worker privileges.

## Rollback strategy

### Documentation and migration generation

Revert repository commits; no deployed rollback applies until execution is
separately authorized.

### Future fresh replay

Destroy the isolated test project and correct canonical migrations. Never use a
failed fresh replay as a Production repair.

### Future Production reconciliation

- capture pre-change catalog and policy definitions;
- keep schema changes and history repair in separate transactions/runbooks;
- define object-specific reversal for every corrective statement;
- preserve data and avoid column/table removal;
- restore application availability through an approved least-privilege policy
  set, not unconditional anonymous CRUD;
- re-run catalog, API, browser, console, and failed-request verification.

## Risk analysis

| Risk | Severity | Control |
|---|---|---|
| Anonymous/public full CRUD across 59 policies | Critical | Replace after identity migration and negative tests |
| Breaking current anon-backed server routes | Critical | Change principal before policy removal |
| Blind baseline replay on populated Production | Critical | Preserve EXACT objects; corrective migrations only |
| Invented history rows | High | Official runner repair only |
| Deferred function-body comparison | Medium | Use recovered body for fresh replay; inspect before any Production function change |
| Deferred Commerce OS RLS state | High | Future policy migration explicitly establishes and verifies desired state |
| Unproven chronology | High | Timestamp evidence or explicit canonical-order decision |
| Preview/Production drift | High | Collect and compare Preview/Staging output |
| Dependency audit advisories | High, pre-existing | Separate dependency-upgrade Story |

## Verification checklist

- [x] Thirteen Production CSV files present, readable, and hashed.
- [x] All 57 expected table names present.
- [x] Product, workflow, Commerce core, and Git-chain schema inventoried.
- [x] All deployed policies classified for historical and Production meaning.
- [x] No historical DDL recommended for Production replay.
- [x] Function body preserved canonically; deployed comparison deferred.
- [x] Commerce OS historical RLS state formally deferred.
- [x] Preview/Staging comparison classified as a future execution gate.
- [x] Canonical order finalized without claiming historical chronology.
- [x] Official migration adoption strategy finalized; execution approval deferred.
- [ ] Production identity/ownership and RLS design approved.
- [ ] Fresh replay and reconciliation rehearsed.

## Definition of Done assessment

| Requirement | Status |
|---|---|
| Recovery source complete | Complete |
| Production inspection files present | Complete |
| Inspection result coverage complete | Complete for Sprint A; missing grids formally deferred |
| Object classification complete | Complete; no unresolved UNKNOWN findings |
| Replay order finalized | Complete as canonical dependency order |
| Production reconciliation finalized | Complete as strategy; execution is a later high-risk Story |
| Migration generation design ready | Complete; migration creation remains separately unauthorized |

Sprint A is complete with deferred execution items. Sprint B may begin with the
Domeggook Live Search vertical slice because it is read-only and independent of
future migration/RLS execution, subject to its own architecture and security
gates.
