# Production Access Matrix v1

## 2026-07-30

- Added a default-deny, machine-verifiable R0 access matrix for all 60 public
  tables declared by migrations 000 through 021.
- Recorded current and target principals, consumer evidence, mutation classes,
  idempotency, audit, and failure requirements by security boundary.
- Added a contract test that blocks missing or duplicate table assignments and
  keeps reconciliation SQL disabled until R1 prerequisites pass.
- No migration, schema, RLS, grant, secret, runtime, or Production change.
