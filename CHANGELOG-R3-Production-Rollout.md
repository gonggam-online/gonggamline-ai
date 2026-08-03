# R3 Production Rollout Changelog

## 2026-08-03

- Production history repair completed for exactly `000` through `022`, while
  the first attempted 023 application failed closed before any schema, RLS,
  Auth, or history change.
- Read-only inventory identified an exact previously unmodelled pre-state:
  the three restored Product policies, all seven Product privileges effective
  for `anon`, `authenticated`, and `service_role`, no PUBLIC Product grant,
  and the canonical restricted R1 function execute matrix.
- Candidate 023 now classifies Product and function pre-states independently.
  It accepts the exact Production mixed matrix only when function ACLs are
  canonical; partial function ACLs and canonical Product plus permissive
  function ACLs remain blocked.
- Canonical `000`-`023`, exact Production mixed, and legacy restored rehearsals
  passed in disposable local Supabase 2.110.0. A partial-function-ACL negative
  rehearsal failed closed before mutation.
- Revised candidate canonical LF SHA-256:
  `c00f6e21d00e78fe112fd3d8369006b077daf49115b148392ae25481245126bd`.

## 2026-08-01

- Recorded the new restricted PostgreSQL 17.6 Production logical backup,
  independent archive/hash/ACL validation, and direct `BEGIN READ ONLY`
  migration-history/catalog preflight.
- Added the exact high-risk/manual approval packet for 000-022 official CLI
  history repair, 023-only dry run, separate migration approval, monitoring,
  stop conditions, and rollback.
- No Production history, schema, RLS, Auth, grant, or commerce write was
  performed.
