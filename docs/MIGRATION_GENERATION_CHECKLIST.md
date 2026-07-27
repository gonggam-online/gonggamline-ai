# Migration generation checklist

No official migration may be generated until every required item is checked.

## Evidence

- [x] Products baseline source is complete and verbatim.
- [x] Product workflow source is complete and verbatim.
- [x] Commerce OS core source is complete and verbatim.
- [x] Historical development RLS source is complete and verbatim.
- [x] Migrations 003–020 are preserved.
- [x] Thirteen Production CSV files are present and hashed.
- [ ] Export `public.set_updated_at()` function definition and attributes.
- [ ] Export RLS-enabled/forced state for all six Commerce OS tables.
- [ ] Collect equivalent Preview/Staging catalog output.
- [ ] Supply SQL Editor timestamps and revision/execution provenance.

## Classification and decisions

- [x] Every expected object/property has EXACT, COMPATIBLE, INCOMPATIBLE,
  ABSENT, or UNKNOWN classification.
- [ ] Resolve every required UNKNOWN.
- [ ] Approve a canonical chronology or explicitly approve a non-historical
  canonical replay order.
- [ ] Choose the official migration runner.
- [ ] Identify and document its metadata/version/checksum format.
- [ ] Decide whether official baseline stamping is supported and required.
- [ ] Approve the Production identity and ownership model.
- [ ] Approve the immediate and long-term RLS policy designs.

## Migration design

- [ ] Approve pre-003 baseline filenames without renaming existing 003–020.
- [ ] Keep fresh-replay baseline migrations separate from deployed corrective
  migrations.
- [ ] Assign any Production corrective migration after the current chain.
- [ ] Define locks, backfills, defaults, constraint validation, schema-cache
  refresh, deployment order, and rollback for each change.
- [ ] Prove idempotency expectations without relying on `IF NOT EXISTS` as a
  compatibility check.
- [ ] Prohibit direct metadata inserts and speculative history rows.

## Security and verification

- [ ] Map every application operation to a principal and least privilege.
- [ ] Add positive and negative RLS tests.
- [ ] Verify no anonymous write dependency remains.
- [ ] Verify server-only secrets cannot reach browser code or logs.
- [ ] Rehearse fresh replay in an isolated database.
- [ ] Rehearse Production reconciliation in Preview/Staging.
- [ ] Run catalog comparison, lint, typecheck, tests, build, and browser gates.
- [ ] Obtain database/security owner approval and a rollback window.

Migration generation readiness is **65%**: source recovery and Production
catalog presence are strong, but chronology, migration metadata, function/RLS
evidence, Preview parity, and security ownership remain blocking.
