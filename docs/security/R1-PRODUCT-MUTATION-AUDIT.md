# R1 Product Mutation Consumer and Contract Audit

## Outcome

Five externally reachable Product mutation surfaces currently write through
the shared anonymous Supabase client. None invokes the accepted Admin request
guard, exact-origin JSON CSRF, mutation idempotency contract, or immutable
security audit boundary.

The machine-verifiable inventory is
[`r1-product-mutation-audit.json`](r1-product-mutation-audit.json).

The highest-risk finding is `GET /api/domeggook-search`: a nominal search read
also upserts every returned Product. R1 must split this into a persistence-free
read and an explicit protected import command. This is required before Product
anonymous write policies can be removed safely.

## Mutation surfaces

| Route | Current write | Primary gap |
|---|---|---|
| `GET /api/domeggook-search` | Product UPSERT | GET side effect; anonymous financial/catalog persistence |
| `PATCH /api/products/[id]` | Product UPDATE | anonymous operator and manual-price mutation |
| `POST /api/products/[id]/competition` | Product UPDATE | anonymous manual decision input |
| `POST /api/products/[id]/competition/auto` | Product UPDATE | anonymous trigger and shared worker credential |
| `POST /api/competition/analyze-batch` | bounded Product batch UPDATE | anonymous batch trigger and partial-failure audit gap |

## R1 implementation instruction

After PR #52 is merged:

1. Rebase the R1 implementation branch on that merge commit.
2. Reuse the accepted Admin guard, AAL2, exact-origin JSON CSRF, rate-limit, and
   guarded service-role boundaries already implemented for Item Selection.
3. Make Domeggook search persistence-free and introduce a separately named
   protected Product import command.
4. Protect Product PATCH and manual competition mutation with route-specific
   input/column allowlists and idempotency.
5. Authorize automatic analysis triggers as Admin actions while isolating
   database persistence in a competition-worker-specific client boundary.
6. Add immutable audit evidence and deterministic partial-failure behavior.
7. Preserve existing public response contracts unless a separately reviewed
   contract change is unavoidable.

Because this implementation touches Auth/authorization and financial fields,
the implementation PR is high-risk, receives `manual-merge-required`, and is
never auto-merged.

## Non-goals

This audit changes no runtime behavior, Auth, CSRF, RLS, grant, migration,
financial formula, public API response, secret, or Production state. It does
not authorize R1 implementation or R2 SQL.

## Rollback

Revert this audit commit. No runtime or external state changes.
