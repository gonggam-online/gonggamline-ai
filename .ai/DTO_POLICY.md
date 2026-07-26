# DTO policy

DTOs are explicit public or cross-boundary contracts, not persistence models.

- Define strict TypeScript types with intentional nullability and field names.
- Map database/provider/domain values through a dedicated mapper.
- Do not use `select("*")` output, Supabase rows, or external payloads as public
  response types.
- Keep computation in the owning domain; DTO mappers transform representation
  without recalculating business rules.
- Preserve existing fields and semantics by default. Breaking changes require
  explicit versioning, consumer migration, contract tests, rollout, and rollback.
- Sanitize errors and omit secrets/internal-only fields.
- Contract tests must assert default and opt-in/versioned shapes.

New public DTO families are part of a new Public API boundary and require the
architecture gate in [`ARCHITECTURE_REVIEW.md`](ARCHITECTURE_REVIEW.md).
