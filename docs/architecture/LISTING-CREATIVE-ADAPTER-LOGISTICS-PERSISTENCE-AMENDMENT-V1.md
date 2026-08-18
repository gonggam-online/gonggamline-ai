# Listing creative adapter logistics persistence amendment v1

Status: implemented in a high-risk/manual PR; no WING write is authorized.
Observed: 2026-08-18 (Asia/Seoul)

## Decision

The Coupang read-only address lookup is an optional acquisition path, not a
required step for every packet run. When the owner has verified the exact WING
outbound and return-center codes, the operator may bind them once to the typed
external-adapter packet using an owner-scoped approval reference. The packet,
its readiness digest, and the sanitized evidence fingerprint are then written
to the existing Supabase private immutable object store. Later export,
recovery, and registration validation reuse that digest-bound packet without
calling the Coupang address API again.

This removes the recurring external-IP/allowlist failure from the critical
path. It does not infer a code, treat an address as a code, or bypass admin
authentication, CSRF, category validation, live-write approval, or WING's own
submission boundary.

## Evidence and privacy contract

- `logisticsEvidenceMode=OWNER_CONFIRMED_WING` identifies the one-time owner
  confirmation; API-acquired evidence remains `COUPANG_READ_ONLY`.
- The evidence source records only an owner-controlled source reference,
  observation time, ruleset/schema versions, and a canonical SHA-256 digest.
  Raw Coupang responses and secrets are never persisted.
- Address selectors are retained only inside the private packet needed for
  later operator review. They are never emitted in sanitized review DTOs or
  logs.
- Codes are validated as bounded opaque identifiers. The importer requires a
  non-empty `owner:`/`owner/` approval reference and rejects malformed codes,
  missing address selectors, stale timestamps, and unknown request keys.
- Immutable packet storage is the remote source of truth and recovery path;
  the browser textarea and downloaded JSON are disposable clients.

## Operational boundary

The new authenticated import route uses the existing mutation guard and CSRF
purpose, then persists the packet. It is a one-time owner action when the
read-only API is unavailable. It never performs a WING product write, paid
image generation, publication, or registration submission. The existing API
lookup remains available as a convenience when its credentials and allowlist
are healthy.

If a packet is lost, recovery uses its private digest through the existing
protected recovery endpoint; no raw packet is reconstructed from Git fixtures.
The owner must re-verify only when the WING code or approval has actually
changed.

## Rollback

Disable the manual import UI/route and keep existing immutable packet objects;
future runs can use the read-only enrichment path. Removing the code must not
delete private packet objects or alter existing WING data.
