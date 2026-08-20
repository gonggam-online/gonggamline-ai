# Listing Generator v2 competitive review packet

- Integrates exact 15A keyword, 15B title, 15C creative, 16A story, and 16B
  rendered-detail packet digests in one deterministic Shadow review packet.
- Adds current category/policy and rights/grant/edit-operation drift checks that
  fail closed on stale, unknown, conflicting, prohibited, or revoked evidence.
- Emits a provenance-linked title, ranked keywords, rights-cleared rendered
  detail page, five-part competitiveness score, human-review instructions, and
  rollback metadata.
- Preserves the legacy `generateListingDraft`, `listing.service`, public APIs,
  Item Selection scores/ranks, and all publication/commerce boundaries.
