# Market Intelligence Shadow v1

- Added a deterministic, evidence-gated market-intelligence Shadow evaluator.
- Kept live Item Selection verdicts and all external/commerce boundaries
  unchanged.
- Added freshness, confidence, coverage, competition, supply, rights, and
  profitability gates with fail-closed missing-data behavior.
- Added Architecture Story for approved future source adapters, cloud state,
  Queue/runtime, and calibration gates.

# Market Intelligence collection v1

- Added the bounded HTTPS observation collector for official/public adapter
  lanes, with strict response normalization and a 50-observation cap.
- Added fail-closed handling for missing endpoint, malformed payload, 403, and
  429; no estimated-data fallback is used by the live collector.
- Protected collection execution with the existing owner AAL2, exact-origin,
  CSRF, and rate-limit controls. Item Selection operational verdicts remain
  unchanged; live verdict integration is a separate Story.

# Item Selection Shadow review v1

- Added an administrator-only, read-only comparison packet joining exact
  market evidence to the existing Item Selection result.
- Operational verdicts and scores remain unchanged; incomplete, stale, or
  rights-uncleared evidence stays fail-closed and requires manual review.
- No marketplace, purchase, listing, paid, asset-publication, or Production
  write is authorized. Live integration remains separately approved.

# Item Selection Shadow review UI v1

- Added an administrator-only comparison panel to the existing Item Selection
  page for exact market-product evidence.
- The panel displays the Shadow decision, eligibility, confidence-adjusted
  score, missing facts, and the unchanged operational verdict.
- Requests remain read-only and default to incomplete profitability and
  unknown rights, so the panel cannot authorize a live recommendation.

# Item Selection market enrichment v1

- Administrator Item Selection runs now request exact, read-only Market
  Intelligence enrichment by provider item number.
- Opportunity, demand, growth, supply, and confidence metrics populate the
  existing score areas when evidence exists; missing facts remain unavailable
  within the existing canonical snapshot contract.
- The API default remains `OFF` for compatibility. No rights gate, purchase,
  listing, marketplace write, paid call, or Production verdict authority was
  added.

# Engineering operating discipline

- Authorized Stories now continue silently through safe implementation,
  verification, and delivery. Routine intermediate chat reports are replaced
  by durable `.codex/WORK_STATUS.md` checkpoints.
- User-facing reporting is reserved for terminal completion or a genuinely
  blocking owner action; required safety and manual high-risk boundaries are
  unchanged.

# Item Selection evidence ordering v1

- ENRICH-mode evaluations are now persisted in deterministic verdict and score
  order, using available-data score when complete score is unavailable.
- The ordering only prioritizes candidates for review; missing profitability,
  rights, and hard-gate evidence still prevents an automatic recommendation.
