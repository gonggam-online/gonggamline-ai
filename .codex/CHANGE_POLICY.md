# Change policy

## Allowed without extra owner approval

Normal-risk documentation, tests, diagnostics, read-only UI/API work, and behavior-equivalent refactoring that preserves contracts and requires no schema or external configuration change.

## Stop and classify high-risk

Any migration/schema/RLS/auth change, secret or environment change, pricing/margin behavior, marketplace write, order/inventory/fulfillment, supplier purchase, payment/settlement, destructive action, bulk write, or paid external call.

## Never use as a shortcut

- Catching unexpected failures and returning success/empty data
- Mock data in production paths
- Test skips, disabled lint/type checks, explicit `any`, or unsafe assertions
- Invented schema/configuration/API contracts
- Feature deletion to pass checks
- Force push, direct `main` edits, or secret output

## Change sequence

Investigate → classify external/DB/code → record evidence → preserve contracts → implement smallest change → test failure and success paths → update changelog/status → deliver through PR. Roll back by reverting the coherent commit unless a task documents a safer domain-specific procedure.
