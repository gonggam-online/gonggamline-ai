# Domain guidelines

## Ownership

Each business concept has one owning domain and one authoritative implementation
for its rules. Existing domains include Discovery, Competition, Marketplace
Intelligence, Supplier/Procurement, Listing, Coupang Seller, Decision/Memory,
Revenue, and Runtime Queue/Workers.

## Rules

- Domain logic is typed, deterministic where possible, and independent of HTTP
  and presentation.
- Routes do not calculate business outcomes.
- Services orchestrate; they do not duplicate engine rules.
- Cross-domain communication uses explicit contracts/DTOs, not database row
  leakage or hidden imports.
- External adapters translate provider contracts at the infrastructure edge.
- Human approval remains between analysis/draft work and commerce, pricing,
  purchasing, inventory, fulfillment, or marketplace writes.
- New domain ownership requires an approved Architecture Story.

Record ownership or dependency changes in
[`DECISION_LOG.md`](DECISION_LOG.md) and verify them through
[`ARCHITECTURE_REVIEW.md`](ARCHITECTURE_REVIEW.md).
