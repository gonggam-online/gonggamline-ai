# Item Selection Shadow Review v1

This Story exposes a read-only administrator comparison packet between an
existing Item Selection result and the evidence-gated Market Intelligence
Shadow evaluator. It is a review aid, not a replacement decision engine.

## Boundaries

- Existing verdict and score are returned unchanged and are never mutated.
- Evidence is joined by exact `marketProductId` and provider item number; no
  fuzzy identity mapping is permitted.
- Missing, stale, incomplete, or rights-uncleared evidence remains fail-closed
  and requires manual review.
- The route performs no database mutation, marketplace write, purchase,
  listing, asset publication, paid call, or Production operation.
- Future live integration requires a separately approved Story, calibration,
  and manual merge.

Market evidence remains in the approved Supabase source of truth and the
packet is recomputable from the exact evidence rows. No local durable state is
introduced.
