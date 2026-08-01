# R3 history rehearsal implementation

## Implemented safe surface

`scripts/validate-r3-history-rehearsal.ts` validates a sanitized, versioned
evidence bundle without connecting to a database. It fails closed unless two
fresh isolated restore cycles prove the pinned 000-022 migration artifacts,
exact history, unchanged catalog and Product-row fingerprints, empty dry-run,
deterministic replay, and all negative gates.

The repair-plan fingerprint contains only the pinned CLI version, operation,
target class, and versions. It contains no database URL, password, project ref,
or command capable of execution.

## Deliberately blocked execution adapter

No repair runner is included yet. The approved architecture simultaneously
requires a Docker target with network mode `none` and no published ports, use
of the official Supabase CLI, and no database URL in process arguments. The CLI
cannot reach that target under those controls. Direct SQL is prohibited and is
not an alternative.

Before an execution adapter is implemented or run, Database/Security must
approve one exact transport design that preserves quarantine without exposing
credentials. The proposal must identify the container/network transition,
credential channel, pinned CLI image or binary, exact target identity, repair
plan fingerprint, monitoring, teardown, and rollback. Production remains
prohibited.

## Validator usage

```powershell
npx.cmd tsx scripts/validate-r3-history-rehearsal.ts `
  '<restricted-location>/r3-history-rehearsal-evidence.json'
```

The evidence file remains outside Git. A passing result does not itself
authorize repair, Production history changes, migration 023, or PR #64 merge.
