# R3 isolated CLI sidecar

## 2026-08-01

- Added a digest-pinned, offline-built Supabase CLI 2.110.0 sidecar.
- Preserved the restored database's network-none/no-port quarantine through
  Docker network-namespace sharing and loopback-only access.
- Added non-root, read-only, capability-free runtime controls plus ephemeral
  HOME and pgpass tmpfs handling.
- Added exact plan, Production-marker, target-state, and explicit-execution
  fail-close gates.
- Built image
  `sha256:13d9fe6fb6790d29c4f816b6cc14ec9271dc91a35f395c4315ecd09df5002128`
  and verified CLI 2.110.0 without connecting to the database.
