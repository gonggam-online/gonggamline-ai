# Evidence-bound Persuasive Story Architecture v1

## v2 creative-evidence binding

- Binds exact 15A keyword, 15B title, and 15C creative packet versions and
  digests; version, digest, category, policy, or generation-time drift fails.
- Carries verified creative candidate, source-asset, rights-grant, and exact
  edit-operation provenance into the 16B handoff packet.
- Adds creative evidence to candidate score breakdowns and requires fresh claim
  and persona evidence, quarantining stale facts instead of promoting them.

## Added

- deterministic, versioned story blocks for problem/context, empathy, solution,
  proven core benefit, use scene, contents/usage, objections/FAQ, trust/notice,
  and CTA;
- sentence-level claim, fact, source, and evidence-digest provenance;
- verified persona/intent mappings and required-objection coverage;
- two deterministic story candidates with transparent ranking breakdowns;
- fail-closed quarantine for `UNKNOWN`, `CONFLICT`, `PROHIBITED`, missing
  provenance, forbidden terms, and prohibited-claim patterns;
- human revision limited to pre-approved evidence-bound phrasings, with a
  reviewer/timestamp/selection audit record;
- a stable Shadow-only packet contract for 16B.

## Safety and compatibility

- The input binds `kk946-keywords-v1` and the exact 15A packet digest
  `9808c36fff368d26fe0731f356548199b11c0e14e92c65a1b998305cc87415a4`.
- The packet is always `mode=SHADOW` and `executionEligible=false`.
- No LLM/provider call, Secret, database/API/UI change, listing submission,
  price, advertising, order, procurement, Production, or commerce write exists
  in this Story.
