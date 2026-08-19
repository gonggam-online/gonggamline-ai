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
