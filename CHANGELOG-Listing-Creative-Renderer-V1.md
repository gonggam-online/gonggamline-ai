# Listing Creative Renderer v1 changelog

## 2026-08-14

- Reintegrated the sanitized KK946 WING external adapter packet from PR #126 on
  top of merged creative Architecture PR #127, excluding unrelated orchestrator
  changes.
- Added product-agnostic v3 creative/provider/render-job/artifact contracts.
- Added operation-specific source-rights evaluation: unchanged supplier use can
  pass independently, unknown edit capabilities and observation pixels cannot
  enter derivatives/provider inputs, and revocation/expiry/digest drift forces
  reevaluation.
- Added a deterministic provider that emits actual PNG bytes and computes digest,
  decoded MIME, dimensions, byte size, mobile-width and deployability QA.
- Added two-candidate fixture planning, digest-bound selected-set mapper guards,
  evidence/category/policy/revision approval bindings, and a mobile review page
  with real in-memory raster previews.
- Fixture output is explicitly `FIXTURE_ONLY`; it cannot enter an approved
  marketplace payload or masquerade as a real provider asset.
- Real provider, managed asset storage, durable approvals/learning, and live
  marketplace writes remain separately gated.
