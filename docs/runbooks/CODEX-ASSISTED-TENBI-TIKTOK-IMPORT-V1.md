# Codex-assisted Tenbi · TikTok import runbook v1

## Operating flow

1. The owner asks Codex to update Tenbi and TikTok market information.
2. Codex opens the official login or data page in the in-app browser.
3. The owner completes authentication and reports only that login is complete.
4. Codex reads or downloads only data exposed by the official signed-in UI or official export control.
5. Codex normalizes the permitted rows, preserves the source URL and observation time, and uses the guarded import endpoint.
6. Invalid rows are quarantined while valid rows continue. Repeated source digests remain idempotent.
7. Codex rebuilds market intelligence and verifies the verified-SKU top-ten output.

The owner is not expected to copy, paste, reshape, or upload market rows manually.

## Boundaries

- Do not infer or reverse-engineer an internal API.
- Do not copy browser sessions, cookies, credentials, or tokens.
- Do not use unofficial scraping.
- TikTok signals count only when they bind to the actual product identity; generic trends remain excluded.
- Tenbi observations preserve `upstreamSource` separately from `observedVia` to prevent duplicate weighting.
- This is a request-triggered browser-assisted flow until an approved official API or scheduled official export exists.
