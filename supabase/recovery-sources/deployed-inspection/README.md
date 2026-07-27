# Deployed schema inspection sources

These thirteen SQL files are operator-run, read-only catalog inspections. They
are evidence sources, not migrations or restoration SQL. Run them in numeric
order and copy each result set into the matching section of
`docs/SUPABASE_DEPLOYED_INSPECTION_RESULTS_TEMPLATE.md`.

No file in this directory reads application rows other than aggregate counts.
No file dynamically queries a discovered metadata table. The migration
metadata file only identifies candidates for operator review.

Do not run restoration SQL during this inspection phase. Do not include
credentials, connection strings, tokens, API keys, or raw commercial records
in returned evidence.
