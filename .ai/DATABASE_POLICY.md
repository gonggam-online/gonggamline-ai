# Database policy

Ordered SQL under `supabase/migrations/**` is the intended schema history.
Every query must be checked against migrations, columns, aliases, conflict keys,
relationships, and foreign keys.

- Never invent a table, column, relationship, constraint, RLS policy, or
  migration to compensate for unknown deployed state.
- Schema, migrations, RLS, auth, and Production writes are high-risk and manual.
- Preserve backward compatibility across deployment order; document backfill,
  locks, indexes, defaults/nullability, rollback, and schema-cache behavior.
- Refresh generated database types when the project adopts them.
- Use least privilege and explicit RLS evidence; never expose secret keys.
- Diagnose schema-cache or Preview/Production drift as database/deployment
  failures, not application success states.

The repository currently lacks the authoritative migration that creates the
referenced base `products` table. Follow
[`../DATABASE_GUIDE.md`](../DATABASE_GUIDE.md); do not guess it.

Any new Database or Migration requires a completed Architecture Story plus
explicit owner approval before implementation.
