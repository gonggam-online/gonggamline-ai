# Competitive Keyword Intelligence v1

## Added

- canonical keyword groups for core, related, and problem/use-case keywords;
- explicit synonym, spelling, spacing, and language-variant normalization;
- demand, competition opportunity, trend, content-gap, profitability,
  relevance, confidence,
  provenance, freshness, and exclusion breakdowns;
- stable SHA-256 evidence and packet digests plus deterministic ranking;
- Naver, YouTube, and DataForSEO response normalization contracts with
  fail-closed malformed, 403, 429, empty, and cost-ceiling behavior;
- a synthetic `KK946` 15B handoff packet fixture.

## Safety and compatibility

- Results are `SHADOW` only and do not change Item Selection verdicts, scores,
  candidate rankings, listing state, or commerce execution.
- Unknown rights, stale evidence, and conflicts are quarantined without score.
- No provider request, Secret, scraping, paid call, database write, or
  Production mutation is included.
