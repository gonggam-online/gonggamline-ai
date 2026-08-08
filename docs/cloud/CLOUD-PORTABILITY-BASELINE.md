# Cloud Portability Baseline

## Outcome

This baseline converts the Cloud-first policy into an executable inventory and
new-PC readiness check. It performs no cloud provisioning or data movement.

Run from the repository root:

```powershell
npm.cmd run cloud:readiness
```

The command returns sanitized JSON. `ready: true` means this checkout has the
minimum replaceable-PC prerequisites. `migrationBlockers` are program-level
durable-state migrations; they do not expose local paths or secret values.

## Current state

The machine-readable authority is
[`cloud-state-manifest.json`](cloud-state-manifest.json). Current strengths:

- GitHub owns source, schema history, task recovery, decisions, and CI evidence.
- Vercel owns linked deployment/Preview evidence.
- Supabase owns accepted operational Postgres/Auth boundaries.
- Secret values stay in environment-scoped approved stores.

Known migration blockers:

1. Production backup evidence still has a device-local authority recorded by
   R3. It must move only after encrypted target, region, access, retention,
   checksum, restore rehearsal, and deletion approval.
2. Phase 4 Orchestrator state uses a device-local SQLite ledger. Its managed
   replacement must preserve transaction, lease, idempotency, audit, restart,
   cost, and fail-closed behavior.
3. Product/listing assets and business evidence lack one complete approved
   object-storage authority. Rights and retention classification precede
   provider selection.

## New-PC readiness contract

The check fails closed unless it can verify:

- Node.js 22 or newer;
- exact repository root and GitHub origin;
- a non-`main`, non-detached task branch;
- GitHub CLI authentication;
- a clean working tree before device transfer;
- tracked dependency lock, Cloud-first policy, and Work Status.

It never reads `.env.local`, secret values, database rows, browser cookies, or
Production data. Installing dependencies and running full repository gates
remain explicit steps after clone.

## Ordered next Stories

1. Encrypted Cloud Backup Architecture and provider decision packet.
2. Orchestrator Managed Ledger Architecture and disposable migration rehearsal.
3. Product Evidence Object Storage inventory and rights/retention contract.
4. Cross-PC bootstrap installer after exact supported OS/toolchain targets are
   approved.
5. Previous-PC-unavailable recovery drill after the first three authorities are
   remotely recoverable.

Every later Story retains its database, Production, secret, personal-data,
paid-service, destructive, and commerce approval boundary.
