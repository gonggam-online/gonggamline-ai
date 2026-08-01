# R3 migration-history reconciliation runbook

## Current authorization

This runbook is architecture and read-only discovery only. Do not execute any
repair, push, linked reset, schema mutation, or Production write from this
document.

## Read-only classification

Run only against an owner-approved isolated, quarantined restore:

```powershell
psql '<isolated-secret-url>' --no-psqlrc --set ON_ERROR_STOP=1 --quiet --csv `
  --file supabase/recovery-sources/r3-migration-history-classification.sql `
  > '<restricted-location>/r3-migration-history-classification.csv'
```

The query starts `BEGIN READ ONLY`, emits catalog metadata only, and rolls back.
The output records migration-history presence, 021/022 relations and functions,
relevant policies, extensions, and public-table count. It does not prove exact
migration equivalence by itself.

## Later implementation checklist

1. Verify the current backup SHA-256 and quarantine controls.
2. Verify `supabase/baseline-manifest.json` and migrations 000-022.
3. Run the separately implemented full object-level comparator.
4. Stop unless every version is `EXACT` or explicitly approved `COMPATIBLE`.
5. Present the exact pinned CLI, target, versions, commands, expected history,
   dry-run result, and rollback for owner approval.
6. Rehearse official CLI repair only on a fresh isolated restore.
7. Prove catalog equality before/after the metadata-only repair.
8. Require a second fresh-restore replay with the same fingerprints.
9. Keep Production blocked until a separate exact-target approval.

## Permanent prohibitions

- no direct SQL insert/update/delete of migration history;
- no Production `db reset --linked`;
- no historical DDL replay against Production;
- no `db push` without exact dry-run review;
- no candidate 023 generation before repaired-history R2 inventory passes; and
- no rollback that restores anonymous Product writes.
