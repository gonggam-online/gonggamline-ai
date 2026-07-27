# Migration generation checklist

No official migration may be generated until every required item is checked.

## Evidence

- [x] Products baseline source is complete and verbatim.
- [x] Product workflow source is complete and verbatim.
- [x] Commerce OS core source is complete and verbatim.
- [x] Historical development RLS source is complete and verbatim.
- [x] Migrations 003–020 are preserved.
- [x] Thirteen Production CSV files are present and hashed.
- [x] Preserve the recovered `public.set_updated_at()` body as canonical;
  deployed equivalence is DEFERRED until a Production function change is proposed.
- [x] Classify Commerce OS RLS-enabled/forced state as DEFERRED; the future
  policy migration must explicitly establish and verify the desired state.
- [x] Classify Preview/Staging output as required before Production execution,
  not required for Sprint A close-out.
- [x] Finalize canonical dependency order without historical timestamps.

## Classification and decisions

- [x] Every expected object/property has EXACT, COMPATIBLE, INCOMPATIBLE,
  ABSENT, or DEFERRED final classification.
- [x] Resolve every former UNKNOWN as COMPATIBLE or DEFERRED.
- [x] Approve canonical dependency replay as independent of historical chronology.
- [x] Select the Supabase-supported migration workflow as the adoption boundary.
- [x] Defer runner metadata/version/checksum inspection to the execution Story.
- [x] Define official repair/baseline use or a forward-only boundary; prohibit
  manual metadata inserts.
- [x] Finalize the immediate and long-term RLS strategy.
- [ ] Approve concrete Production identity/ownership implementation before RLS execution.

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

Sprint A migration-design readiness is **100%**. Actual migration creation and
Production execution remain separately unauthorized until the unchecked
implementation/security gates are satisfied.
