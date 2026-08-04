# Sales Learning Closed Loop and First Experiment v1

Status: Proposed Architecture Story; repository-owner approval required

Risk: high-risk/manual because later implementation crosses Database, privacy,
financial calculation, marketplace, order, settlement, and real-loss boundaries

Owner: repository owner / AI CTO

Implementation authorization: none. This Story does not authorize a migration,
Production read or write, personal-data processing, listing, price, advertising,
inventory, procurement, order, return, settlement, payment, or paid call.

## 1. Problem and business objective

The accepted Orchestrator Architecture defines a sales-learning sequence, but
the repository cannot yet prove that one externally observed candidate became
one listing, generated marketplace orders, reached settlement, and produced an
accounting-complete actual net profit. Existing estimates and partial feedback
must not be treated as that proof.

The objective is the smallest auditable closed loop that measures forecast
error and informs a versioned policy proposal. Success is one owner-approved
experiment whose evidence can be followed from candidate to final settlement
without autonomous commerce writes or estimate/actual conflation.

Revenue impact: replace opinion-driven product iteration with observed unit
economics, stop losing experiments at a bounded cap, and improve the next
candidate decision using traceable error rather than self-reported success.

## 2. Current-state evidence and root-cause classification

Root-cause class: **Database/approved data-contract gap**, preceded by external
provider and privacy configuration questions. This is not a code failure.

- `market_estimates` stores versioned estimates, while
  `market_model_feedback` stores only optional units, sales, advertising spend,
  and return count. It has no listing, marketplace order, settlement, fee,
  refund, tax, landed-cost, or accounting-close identity.
- `revenue_opportunities` stores estimates and `revenue_decisions` exposes an
  unqualified `actual_impact`; neither proves source class, observation period,
  currency, settlement finality, or net-profit composition.
- `listing_drafts` correlates with internal procurement/workflow records, but
  the inspected schema does not establish a marketplace listing-to-order-to-
  settlement chain.
- Production schema security reconciliation remains approval-gated. Existing
  permissive development policies cannot be accepted for sales or settlement
  evidence.

Therefore implementation must stop at Architecture. Code must not synthesize
missing joins, store raw marketplace payloads, or call partial feedback
`ACTUAL_NET_PROFIT`.

## 3. Scope and non-goals

In scope for this Architecture:

- stable correlation identities and evidence classes;
- estimate snapshots separate from observed and accounting-final facts;
- an append-only experiment lifecycle and reconciliation rules;
- privacy, security, observability, recovery, and retention requirements;
- a bounded first-experiment approval packet and metric definitions;
- ordered implementation Stories and manual approval points.

Non-goals:

- schema, migration, RLS/Auth, API, UI, worker, or connector implementation;
- reading Production or marketplace data;
- selecting the actual SKU, supplier, price, account, or launch date;
- creating a listing, buying stock, spending advertising budget, or processing
  an order, refund, settlement, or payment;
- autonomous policy promotion or expanded autonomy.

## 4. Ownership and dependency direction

```text
External Candidate Evidence (Marketplace Intelligence / Supplier)
  -> Experiment application service (correlation and reconciliation only)
    -> Item Selection + Revenue engines (versioned estimates)
    -> Listing / Order / Settlement adapters (observations, read-only import)
    -> Sales Evidence persistence (future approved append-only schema)
  -> Learning evaluator (expected-vs-actual error)
  -> SHADOW policy proposal
  -> owner decision
```

Revenue owns financial definitions. Marketplace adapters own provider contract
mapping, not profit formulas. The experiment service owns correlation and
state reconciliation, not listing/order execution. The Orchestrator may carry
evidence references and propose work, but cannot grant commerce approval or
promote a policy.

## 5. Canonical identities and contracts

Future contracts use opaque internal IDs; provider identifiers are encrypted
or tokenized where appropriate and are never exposed in public DTOs.

| Identity | Purpose | Required invariant |
|---|---|---|
| `experimentId` | one approved hypothesis and cap set | immutable after approval |
| `candidateEvidenceId` | external candidate snapshot | source, observed time, content hash |
| `estimateSnapshotId` | frozen pre-launch forecast | policy/model/formula version and inputs |
| `listingCorrelationId` | internal-to-provider listing link | one provider/account scope, effective interval |
| `orderCorrelationId` | provider order-line observation | unique provider/account/order-line key |
| `settlementCorrelationId` | settlement-line observation | unique provider/account/statement/line key |
| `costEvidenceId` | attributable cost fact | type, amount, currency, source, effective time |
| `evidenceRevisionId` | correction/supersession | append-only; points to prior revision |

Every numeric fact carries `evidenceClass`, `sourceRef`, `observedAt`,
`effectivePeriod`, `currency`, and `revision`. `sourceRef` is an opaque pointer
or sanitized hash, never a secret or raw personal-data payload.

Evidence classes preserve the accepted Orchestrator meanings:

- `EXTERNAL_OBSERVED`: time-bound provider fact, not yet financially final;
- `ESTIMATED`: policy/model forecast with version and confidence;
- `OPERATOR_CONFIRMED`: explicit human assertion with actor and time;
- `ACTUAL`: source-observed operational fact;
- `ACCOUNTING_FINAL`: reconciled, immutable-for-period financial fact;
- `UNKNOWN`: absent, conflicting, or unverifiable.

`ACCOUNTING_FINAL` is a stricter subtype for learning eligibility. An `ACTUAL`
order or provisional settlement is never sufficient for actual net profit.
Corrections append a superseding revision; history is never overwritten.

## 6. Lifecycle and fail-closed transitions

```text
DRAFT
 -> AWAITING_OWNER_APPROVAL
 -> APPROVED_NOT_STARTED
 -> ACTIVE
 -> STOPPED | OBSERVATION_COMPLETE
 -> SETTLEMENT_PENDING
 -> RECONCILED
 -> LEARNING_REVIEWED
 -> CLOSED
```

- Only the owner can move the exact packet to `APPROVED_NOT_STARTED`.
- `ACTIVE` requires a separately approved real commerce action; Architecture
  approval alone is insufficient.
- A cap breach, correlation ambiguity, privacy breach, missing cost evidence,
  or unexpected write moves the experiment to `STOPPED` and blocks new spend.
- `RECONCILED` requires all in-scope order lines to be matched to final
  settlement/refund/fee records or explicitly classified unresolved.
- `LEARNING_REVIEWED` requires owner review of the computed result and any
  SHADOW policy proposal. No automatic model or policy update is allowed.

Idempotency is mandatory per import and commerce action. Duplicate provider
events may add receipt evidence but cannot duplicate financial amounts.

## 7. Estimate and actual separation

The pre-launch snapshot is immutable and contains, at minimum, predicted units,
gross sales, marketplace fees, advertising, fulfillment, landed cost, return
loss, contribution profit, confidence, and formula/policy versions.

The actual ledger is derived only from correlated evidence. For the experiment
period:

```text
actual net profit
= accounting-final settled item revenue
- accounting-final refunds and return deductions
- marketplace commissions and service fees
- advertising spend attributed by the approved method
- outbound/inbound/return fulfillment costs
- landed product cost for fulfilled units
- other owner-approved directly attributable costs
```

VAT, corporate income tax, shared labor, and general overhead are excluded from
this v1 metric unless the owner supplies an approved attribution rule. The UI
and DTO must label it **experiment-attributable actual net profit**, not company
net income.

The result is `UNKNOWN`, never zero, while any mandatory component is missing
or provisional. Forecast error is calculated only after `RECONCILED`:

- absolute error: `actual - estimate`;
- percentage error: `(actual - estimate) / abs(estimate)` only when estimate is
  non-zero;
- unit, revenue, cost-component, return-rate, and profit errors stay separate;
- cohort aggregation must not mix formula versions without explicit grouping.

## 8. First experiment approval packet

The following is the **proposed smallest packet**, fixed for owner decision but
not approved for execution by this Story:

| Control | Proposed v1 value |
|---|---|
| Scope | exactly 1 owner-selected SKU, 1 Coupang listing, 1 seller account |
| Acquisition | no new procurement until separately approved; maximum 10 saleable units from owner-verified stock |
| Duration | 14 calendar days active exposure, then settlement observation until final or 60-day timeout |
| Total cash budget | KRW 300,000 maximum across attributable inventory, fulfillment, listing-related fees, and ads |
| Advertising sub-cap | KRW 50,000 total; KRW 10,000 per calendar day |
| Loss cap | stop new spend/exposure at KRW 100,000 cumulative realized plus committed attributable loss |
| Order cap | 10 paid order lines; no automatic increase |
| Price | exact owner-approved price captured in the execution approval; no automatic repricing |
| Paid calls | none beyond separately approved marketplace/advertising actions |
| Stop actions | pause ads and prevent new exposure/order acceptance where the provider safely supports it; never auto-cancel paid orders |

These caps are ceilings, not spending targets. `committed attributable loss`
includes non-refundable commitments even before settlement. If inventory is not
already lawfully owned and verified, procurement requires its own amount,
quantity, supplier, rights, and rollback approval and the experiment remains
`APPROVED_NOT_STARTED`.

Execution approval must bind the exact SKU/listing/account, sale price, stock
provenance, supplier/brand/content rights, cap values, dates, responsible human,
stop procedure, privacy basis, and evidence-access method. Secret values must
remain in approved stores.

## 9. Metrics and decision rule

Primary metric:

- experiment-attributable actual net profit in KRW after final reconciliation.

Guardrails:

- cumulative realized plus committed loss <= KRW 100,000;
- spend <= total and advertising caps;
- paid order lines <= 10;
- unauthorized writes, duplicate financial amounts, privacy incidents, and
  unresolved cap breaches = 0;
- 100% of included order lines correlated or explicitly unresolved;
- estimate and actual records with valid source/version/time metadata = 100%.

Diagnostic metrics, not success substitutes:

- impressions, clicks, click-through rate, orders, conversion rate, units,
  gross sales, cancellations, returns, refunds, settlement lag;
- actual fee/ad/fulfillment/landed/return cost per fulfilled unit;
- predicted-versus-actual error for units, revenue, each cost component, and
  attributable net profit.

The experiment is **profitable** only when reconciled attributable actual net
profit is greater than KRW 0. It is **not profitable** at KRW 0 or below. It is
**inconclusive** when settlement/cost/correlation is incomplete at 60 days.
No minimum traffic, conversion, or profit threshold is inferred from this
single small sample, and no policy is promoted automatically.

## 10. Privacy and security

- Import only fields required for correlation and financial reconciliation.
- Do not store buyer name, phone, address, delivery memo, payment credential,
  or raw order/settlement payload in the learning domain.
- Tokenize provider order/listing/settlement identifiers with a scoped keyed
  transform or encrypted mapping held behind the approved server boundary.
- Define purpose, lawful basis, access roles, retention, deletion, incident
  response, and provider terms before any Production import.
- Admin Auth/RLS/CSRF and Production Schema Security Reconciliation are hard
  dependencies. Default deny; service-role access stays isolated and audited.
- Logs and artifacts contain sanitized references and hashes only.

Proposed retention for owner/legal review: normalized experiment evidence 24
months after close; correlation mappings only as long as reconciliation and
statutory obligations require; raw provider exports outside the application in
an approved encrypted store with the shortest applicable retention. These are
not approved until privacy/legal review confirms them.

## 11. Failure, recovery, and observability

Classify failures external configuration -> Database -> code. External account
rights, API scope, settlement availability, privacy terms, and seller settings
are checked before schema or code changes.

Required telemetry: experiment state, cap reservations and consumption,
idempotency keys, import watermark, correlation counts, unresolved/duplicate
counts, evidence class/revision, reconciliation age, formula versions, stop
reason, owner approvals, and audit hashes. Monetary dashboards must distinguish
provisional, actual, accounting-final, and unknown totals.

Recovery resumes from provider watermark and idempotency key, replays into a
quarantine comparison, and promotes only a balanced reconciliation. Ambiguous
matches require human review. A failed stop action escalates immediately; the
system must not report the experiment stopped until provider evidence confirms
it.

## 12. Compatibility, capacity, and buy/connect/build

Existing estimate and feedback tables remain untouched. A later migration must
add purpose-built append-only evidence/correlation records or prove an equally
strict design; it must not reinterpret `actual_impact` or nullable partial
feedback as accounting-final history.

V1 capacity is one active experiment, 10 paid order lines, and bounded polling.
Generic order, inventory, return, settlement, and accounting truth should come
from Coupang/ERP/WMS/accounting exports or APIs. Build only GonggamLine-specific
correlation, estimate comparison, approval, and policy-learning views.

Alternatives rejected:

- JSON blobs in `revenue_decisions`: weak identity, privacy, revision, and
  reconciliation semantics;
- extending `market_model_feedback` in place: partial metrics cannot represent
  order-line and settlement-line accounting;
- manual spreadsheet as the system of record: useful as an approved import
  source, but insufficient for idempotent correlation and audit;
- autonomous marketplace execution: outside the accepted authority boundary.

## 13. Test, rollout, rollback, and implementation order

Required future tests include contract/schema validation, estimate/actual
non-conflation, duplicate and correction replay, ambiguous joins, partial and
late settlements, refunds after settlement, currency/rounding, cap reservation
and breach, stop confirmation, privacy redaction, RLS negative cases, audit
tamper, and a hermetic end-to-end 10-order reconciliation fixture.

Ordered Stories, each with separate approval and PR:

1. External/provider and privacy discovery: read-only field inventory, terms,
   retention, and buy/connect/build decision.
2. Database/Auth/RLS Architecture amendment and forward-only migration design.
3. High-risk persistence/import implementation against disposable data only.
4. Read-only reconciliation and expected-vs-actual UI/API.
5. Owner acceptance of the exact experiment packet and SKU-specific economics.
6. Separate commerce execution approvals for listing, stock, price, ads, and
   stop controls.
7. Supervised launch, reconciliation, owner learning review, and closure.

Rollout starts with synthetic fixtures, then an owner-supplied sanitized export,
then read-only Production shadow correlation. Real exposure follows only after
all prior gates and action-specific approvals. Rollback disables imports and
execution credentials, pauses the approved experiment through a human-confirmed
provider action, preserves immutable audit evidence, and reverts application
changes. Historical estimates and actuals are never deleted to fake rollback.

## 14. Architecture compliance and decisions required

- Approved owners reused: Marketplace Intelligence/Supplier, Item Selection,
  Revenue, Listing, and Orchestrator. A future Sales Evidence persistence
  boundary is new and therefore remains unimplemented pending approval.
- Dependency direction, explicit contracts, privacy, failure handling,
  observability, tests, rollout, and rollback are defined.
- No API, schema, lifecycle implementation, external call, or commerce write is
  authorized.

Repository-owner decisions required before acceptance:

1. accept or amend the proposed KRW 300,000 cash cap, KRW 50,000 ad cap,
   KRW 10,000 daily ad cap, KRW 100,000 loss cap, 10-order cap, and duration;
2. choose the exact SKU, account, price, inventory/procurement source, and human
   operator only in a later secret-safe execution approval;
3. approve privacy purpose, access, retention, and provider data method after
   legal/terms review;
4. approve the ordered DB/Auth/RLS and commerce Stories separately.

Approval is recorded only by an owner decision in `.ai/DECISION_LOG.md` with
the approved head SHA and date. Merging this proposed document without that
record does not authorize implementation or the experiment.
