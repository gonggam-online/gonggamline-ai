# Architecture Story: Gaemi Warehouse to Rocket Growth Adapter v1

## 1. Identity and decision status

- Story type: Architecture Story
- Status: proposed; repository-owner approval required
- Date: 2026-08-05
- Risk of this PR: normal-risk documentation only
- Risk of later integration: high-risk/manual
- Owning domain: Supplier / Procurement fulfillment coordination
- New boundary: provider-agnostic third-party logistics (3PL) adapter
- Initial provider candidate: Gaemi Warehouse (`개미창고`)
- Revenue impact: removes routine owner handling from the shortest path between
  an approved supplier purchase and a saleable Rocket Growth unit, while
  preventing basic quantity receipt from being mistaken for product quality.

This Story authorizes architecture, contracts, synthetic fixtures, tests, and
rollout/rollback design only. It does not authorize implementation, account
creation, quotation/contact, payment, supplier order, shipment, warehouse
instruction, inbound, inventory, listing, personal-data processing, secret
configuration, provider write, or Production action.

## 2. Dependency and implementation stop

PR #83 (`codex/docs/third-party-inspection-policy`) is an open Draft as of
2026-08-05. Its proposed default third-party inspection policy is a dependency,
not merged architecture and not implementation authority.

The later adapter implementation must not begin until all of these are true:

1. PR #83, or a repository-owner-approved superseding policy, is merged;
2. this Architecture Story is accepted and merged;
3. the owner supplies and approves the provider contract facts listed in
   section 13 without placing secrets or personal data in Git;
4. a separate implementation Story defines the exact read/write surface; and
5. every commerce, paid, privacy, configuration, and Production boundary keeps
   its manual approval.

If PR #83 changes or is rejected, reconcile this Story before implementation.

## 3. Compliance and revenue-path gate

### AI CTO Compliance Check

- CTO Master Directive: PASS. A new external integration receives an
  Architecture Story before code.
- Project Constitution: PASS. Provider observations, physical evidence,
  decisions, and marketplace artifacts remain distinct sources of truth.
- Architecture Blueprint: PASS. Application services depend on a
  provider-neutral port; a provider adapter depends inward on that contract.
- Risk Policy: PASS for this PR. Documentation changes no runtime, database,
  price, inventory, fulfillment, provider, or Production state.

### Architecture Compliance Check

- Existing domain: Supplier / Procurement fulfillment coordination.
- New External Integration: yes; designed here, not implemented.
- New Public API, Database, Migration, Queue, or runtime lifecycle: none in
  this Story.
- Later persistence, Queue, Auth/RLS, or public API: separate Architecture and
  high-risk/manual review required.

### Smallest revenue-path rationale

The earliest blocked stage after an approved supplier purchase is reliable
physical receipt and Rocket Growth preparation without owner handling. A thin
provider-neutral evidence adapter is the smallest reusable boundary that can
remove that work. Autonomous procurement, generalized WMS synchronization, and
multi-provider routing are excluded because they do not need to precede the
first controlled sale.

## 4. Official public-source audit

Sources were read-only public documents; no account or provider interaction was
performed.

| Source | Published/version evidence | Audited facts | Architecture consequence |
|---|---|---|---|
| [Gaemi Warehouse standard rate card](https://www.gemichango.com/Gemichango_Logistics_cost_chart.pdf) | `2025.06` in filename/document | consultation -> membership/product -> inbound request -> shipment -> quantity receipt/photos/storage -> order -> pick/pack/tracking; quantity inspection is visual and does not guarantee packaging condition or quality; exhaustive stock inspection is separately charged; processing is separately negotiated | basic receipt cannot produce `QUALITY_PASSED`; inspection scope and price must be explicit contract facts |
| [Gaemi Warehouse Rocket Growth manual](https://www.gemichango.com/%EA%B0%9C%EB%AF%B8%EC%B0%BD%EA%B3%A0_%EC%BF%A0%ED%8C%A1%EB%A1%9C%EC%BC%93%EA%B7%B8%EB%A1%9C%EC%8A%A4_%EC%9D%B4%EC%9A%A9%EB%A7%A4%EB%89%B4%EC%96%BC_25.07.pdf) | `25.07` manual | business-member/account approval; product name/image/options and approval; inbound request and printed inbound sheet; 3-4 business-day warehouse approval; stage photos; seller-created Wing inbound; barcode PDF; Gaemi bulk-order Excel; tracking; barcode plus attachment/enclosure PDFs; B2B outbound; Rocket Growth receipt | workflow is multi-system, asynchronous, document-driven, and partly seller-operated; each artifact needs identity, provenance, and reconciliation |
| [Gaemi Warehouse official site](https://gemichango.com/) | accessed 2026-08-05 | membership followed by online inbound/delivery request; provider describes inbound/storage/delivery/returns and configurable operations | public capability claims are discovery evidence only, not an API or SLA contract |

Public documents establish a manual portal/Excel/PDF workflow. They do not
establish a supported API, webhook, customer code, machine export, contract
SLA, data-retention term, or automation permission. Those facts remain
`OWNER_SUPPLIED_UNKNOWN`.

## 5. Audited operating flow

The provider-specific evidence flow is:

```text
approved Domeggook purchase/shipment evidence
  -> Gaemi business account + approved product/option
  -> Gaemi inbound request (dimensions, quantity, carton, applicant)
  -> printed inbound sheet accompanies supplier shipment
  -> Gaemi receives, counts/visually inspects, photographs, locates stock
  -> 3-4 business-day inbound approval window
  -> exception: quarantine / rework quote / return proposal / human review
  -> seller creates Rocket Growth inbound in Coupang Wing
  -> Wing product-barcode PDF + arrival center/date draft
  -> Gaemi B2B bulk-order workbook and order transmission
  -> Gaemi shipment/tracking becomes available
  -> seller completes Wing inbound and downloads attachment/enclosure PDF
  -> Gaemi receives barcode + attachment/enclosure PDFs and performs B2B output
  -> Coupang center receipt evidence
```

The manual states that Wing work is performed by the seller and directs the
seller to Coupang help for authoritative instructions. The 3PL adapter must not
impersonate or silently automate Wing. A later Coupang adapter is a separate
external integration and commerce-write boundary.

## 6. Quality and inspection truth contract

### Non-negotiable distinction

Standard quantity inspection is not quality assurance.

- The public rate card describes carton/bulk quantity inspection as visual.
- It explicitly says the per-box inspection fee is quantity inspection and
  cannot guarantee packaging condition or product quality.
- `receivedQuantity == expectedQuantity` therefore proves count agreement only.
- Receipt photos prove that a photograph was captured at a stage; they do not
  prove every unit was inspected or passed.
- Dimensions entered in an inbound request are declared values until an
  evidence record explicitly identifies them as provider-measured.

The adapter must never infer `QUALITY_PASSED`, legal compliance, packaging
suitability, or marketplace readiness from quantity agreement, stage photos,
inventory availability, or inbound approval alone.

### Inspection levels

```ts
type InspectionScope =
  | "QUANTITY_VISUAL_STANDARD"
  | "CUSTOM_FULL_UNIT_INSPECTION"
  | "CUSTOM_PROCESSING"
  | "OWNER_SUPPLIED_UNKNOWN";
```

- `QUANTITY_VISUAL_STANDARD`: count/identity evidence only; quality remains
  `UNKNOWN` unless separately observed.
- `CUSTOM_FULL_UNIT_INSPECTION`: exact unit population, checklist, defect
  taxonomy, sampling rule (`100%` when truly exhaustive), evidence fields,
  acceptance thresholds, and quote must be owner-approved.
- `CUSTOM_PROCESSING`: barcode, repack, repair, insert, bundle, labeling, or
  other processing; exact instruction and quote must be owner-approved.
- `OWNER_SUPPLIED_UNKNOWN`: fail closed; no instruction or readiness decision.

The public rate card lists exhaustive stock inspection as a paid service and
processing as separately negotiated. It does not prove that the listed
exhaustive stock count is a complete functional/quality examination. The exact
custom quality scope and quote remain unknown until contract evidence is
supplied by the owner.

## 7. Provider-neutral boundary

```text
Supplier / Procurement application service
  -> WarehouseFulfillmentPort
      <- GaemiWarehouseAdapter (future)
      <- Equivalent3plAdapter (future)
  -> evidence admission evaluator
  -> human approval / quarantine decision

Coupang Wing / Rocket Growth adapter (separate future boundary)
  -> supplies seller-created inbound and PDF evidence
  -> never imported by WarehouseFulfillmentPort domain types
```

### Port responsibilities

The future `WarehouseFulfillmentPort` may expose capabilities only after the
provider mechanism is verified:

```ts
interface WarehouseFulfillmentPort {
  capabilities(): Promise<WarehouseCapabilities>;
  findInboundEvidence(query: InboundEvidenceQuery): Promise<EvidencePage>;
  findInventoryEvidence(query: InventoryEvidenceQuery): Promise<EvidencePage>;
  findOutboundEvidence(query: OutboundEvidenceQuery): Promise<EvidencePage>;
  findExceptionEvidence(query: ExceptionEvidenceQuery): Promise<EvidencePage>;
}
```

The architecture approves read-oriented evidence retrieval first. It does not
approve `createProduct`, `createInbound`, `uploadDocument`, `sendOrder`,
`cancelOutbound`, or any equivalent provider write. Each write command needs a
separate exact action contract, idempotency key, approval, price/quantity cap,
precondition, verification, and recovery design.

### Capability truth

```ts
type CapabilityState = "SUPPORTED" | "UNSUPPORTED" | "OWNER_SUPPLIED_UNKNOWN";

type WarehouseCapabilities = {
  provider: string;
  evidenceRead: CapabilityState;
  productWrite: CapabilityState;
  inboundWrite: CapabilityState;
  outboundWrite: CapabilityState;
  photoExport: CapabilityState;
  documentExport: CapabilityState;
  webhook: CapabilityState;
  idempotency: CapabilityState;
  observedAt: string;
  sourceRef: string;
};
```

Unknown capability is never treated as supported. Portal scraping or browser
automation is not an acceptable fallback without a separately approved
security, terms, privacy, and brittleness review.

## 8. Canonical identities and evidence envelope

Provider IDs are aliases, not canonical business identities.

```ts
type WarehouseEvidenceEnvelope = {
  schemaVersion: "warehouse-evidence.v1";
  evidenceId: string;
  provider: string;
  providerAccountAlias: string;
  providerEventId: string | null;
  operation: "INBOUND" | "INSPECTION" | "MEASUREMENT" | "PREPARATION" |
    "OUTBOUND" | "ROCKET_GROWTH_RECEIPT" | "EXCEPTION";
  procurementActionId: string;
  supplierShipmentRef: string | null;
  canonicalSkuId: string;
  providerProductCode: string | null;
  optionIdentity: string | null;
  warehouseInboundRef: string | null;
  warehouseOutboundRef: string | null;
  wingInboundRef: string | null;
  quantities: {
    expected: number | null;
    received: number | null;
    accepted: number | null;
    quarantined: number | null;
    shipped: number | null;
    rocketGrowthReceived: number | null;
    unit: "EA" | "BOX" | "PLT" | "UNKNOWN";
  };
  measurement: {
    subject: "UNIT" | "OUTBOUND_UNIT" | "CARTON" | "UNKNOWN";
    source: "DECLARED" | "PROVIDER_MEASURED" | "UNKNOWN";
    widthCm: number | null;
    depthCm: number | null;
    heightCm: number | null;
    weightKg: number | null;
  } | null;
  inspectionScope: InspectionScope;
  disposition: "OBSERVED" | "QUARANTINED" | "REWORK_PROPOSED" |
    "RETURN_PROPOSED" | "READY_FOR_WING_REVIEW" | "SHIPPED" |
    "RECEIVED_BY_ROCKET_GROWTH" | "HUMAN_REVIEW";
  artifacts: EvidenceArtifact[];
  observedAt: string;
  importedAt: string;
  sourceRef: string;
  contentHash: string;
  correlationId: string;
};

type EvidenceArtifact = {
  kind: "STAGE_PHOTO" | "INBOUND_SHEET_PDF" | "PRODUCT_BARCODE_PDF" |
    "ATTACHMENT_ENCLOSURE_PDF" | "BULK_ORDER_EXPORT" |
    "TRACKING_EVIDENCE" | "EXCEPTION_REPORT" | "OTHER";
  sourceRef: string;
  sha256: string;
  capturedAt: string | null;
  mediaType: string;
  containsPersonalData: boolean | "UNKNOWN";
};
```

Rules:

- Counts are non-negative integers and never inferred from file names.
- Dimensions/weight require units and measurement provenance.
- `null` and `UNKNOWN` remain distinct from zero, empty, false, and passed.
- Provider event identity plus content hash detects replay and mutation.
- Corrections append superseding evidence; they do not overwrite history.
- Raw photos/PDFs are referenced from an approved access-controlled store,
  never committed to Git or copied into general logs.
- `ROCKET_GROWTH_RECEIPT` requires Coupang-origin evidence; a 3PL `SHIPPED`
  status is insufficient.

## 9. Admission and reconciliation rules

The evidence evaluator is pure and fail-closed.

| Condition | Result |
|---|---|
| canonical SKU/option cannot be reconciled | `HUMAN_REVIEW` |
| received count differs from approved shipment | affected units `QUARANTINED` |
| only standard quantity inspection exists | quality remains `UNKNOWN` |
| required custom inspection scope/quote not approved | no warehouse instruction |
| measured value conflicts with catalog/declaration | physical evidence retained; `HUMAN_REVIEW` for business decision |
| barcode or required PDF missing/hash mismatch | no B2B outbound readiness |
| tracking exists but no Coupang receipt | `SHIPPED`, never `RECEIVED_BY_ROCKET_GROWTH` |
| duplicate provider event with same hash | idempotent replay |
| same identity with different hash | immutable conflict + `HUMAN_REVIEW` |
| stale status beyond configured evidence SLA | observable `STALE`; no invented transition |

Supplier catalog facts seed expectations. Provider physical observations may
supersede conflicting declared measurements for evidence purposes, but only an
approved business decision may change listing, economics, or supplier claims.

## 10. State model

This is a proposed evidence lifecycle, not a database or Queue authorization:

```text
AWAITING_PROVIDER_CONTRACT
  -> READY_FOR_MANUAL_INBOUND_REQUEST
  -> SUPPLIER_SHIPPED
  -> WAREHOUSE_RECEIVED
  -> INSPECTION_PENDING
  -> EVIDENCE_REVIEW
      -> QUARANTINED | REWORK_PROPOSED | RETURN_PROPOSED | READY_FOR_WING_REVIEW
  -> WING_INBOUND_DRAFTED
  -> DOCUMENTS_READY
  -> B2B_OUTBOUND_REQUESTED
  -> WAREHOUSE_SHIPPED
  -> ROCKET_GROWTH_RECEIVED
```

Every arrow caused by account, provider, supplier, warehouse, Wing, inventory,
or payment mutation is a high-risk/manual external action. Evidence import may
observe a transition but must not cause the external action implicitly.

`CANCELLED`, `FAILED`, `STALE`, and `HUMAN_REVIEW` are explicit terminal or
paused outcomes. `QUARANTINED` units cannot be made saleable or included in an
outbound request by fallback behavior.

## 11. Files, photos, privacy, and security

- Account credentials, session cookies, customer codes, quote details tied to
  an account, business registration documents, personal contact fields, bank
  data, and provider secrets never enter Git, fixtures, logs, URLs, or public
  DTOs.
- Provider account is represented by a non-secret alias.
- Photos and PDFs may contain names, addresses, tracking numbers, barcodes, or
  commercial data. Import uses least privilege, malware/type validation,
  size/page limits, encryption, retention, access logs, and an approved store.
- Logs contain only provider alias, operation, outcome, latency, retry count,
  evidence ID/hash prefix policy if approved, and correlation ID. Raw document
  content, URLs with tokens, barcodes, tracking numbers, and personal fields are
  excluded.
- Synthetic fixtures use impossible example IDs, generated documents, and no
  copied provider/customer data.
- API/webhook signatures, OAuth, IP allowlists, session automation, and secret
  rotation are `OWNER_SUPPLIED_UNKNOWN` pending provider contract discovery.

## 12. Failure taxonomy and reliability

```ts
type WarehouseAdapterErrorCode =
  | "CONFIGURATION_MISSING"
  | "AUTHENTICATION_FAILED"
  | "AUTHORIZATION_DENIED"
  | "CAPABILITY_UNKNOWN"
  | "VALIDATION_FAILED"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "PROVIDER_ERROR"
  | "RESPONSE_CONTRACT_ERROR"
  | "EVIDENCE_CONFLICT"
  | "DOCUMENT_REJECTED"
  | "PERSONAL_DATA_REVIEW_REQUIRED"
  | "STALE_EVIDENCE";
```

- No error becomes a successful readiness result.
- Retry eligibility and time/rate budgets remain unknown until official
  provider contract evidence exists. The implementation must use conservative
  bounded defaults approved in its Story.
- Reads may be retried only when idempotent. Writes are never retried without a
  provider-supported or application-reconciled idempotency contract.
- Partial pages/exports remain partial and observable.
- Provider downtime never changes quarantine or readiness evidence.

## 13. Owner-supplied UNKNOWN register

All items below are deliberately `OWNER_SUPPLIED_UNKNOWN`; no implementation
may invent them.

| Required fact | Safe owner evidence | Secret/privacy handling | Stop condition |
|---|---|---|---|
| account eligibility and approved legal entity | accepted service agreement/account screen | business and personal fields stay outside Git | no adapter configuration |
| exact quote and billing/VAT/point terms | dated provider quote/rate schedule | financial document in approved restricted store | no cost or margin assumption |
| customer/company code and product code semantics | sanitized field specification | customer code treated confidential until classified | no identity mapping |
| supported API, webhook, SFTP, email, portal, Excel/CSV/PDF export | official technical/manual evidence | credentials/session remain secret | no transport implementation |
| automation/terms permission | contract or written provider authorization | retain access-controlled evidence | no scraping/browser automation |
| authentication, scopes, rotation, environments | official integration contract | approved secret store only | no live connection |
| rate limits, timeouts, pagination, retention, SLA | official contract | no invented defaults represented as provider facts | conservative offline tests only |
| photo/document access and privacy roles | DPA/contract/data map | privacy review required | no personal-data import |
| standard/custom inspection checklist | signed scope | no quality inference | quarantine/UNKNOWN |
| exhaustive quality inspection and processing quote | dated itemized quote | paid action approval required | no instruction/payment |
| barcode responsibility and format | provider + Coupang authoritative requirement | barcode artifact restricted | no outbound readiness |
| Wing/Coupang account and inbound mechanism | separate Coupang contract/adapter evidence | seller secrets excluded | manual Wing only |

Owner action, when ready: obtain these facts through the provider's authorized
account manager or portal, store sensitive originals in an approved encrypted
location, and provide only sanitized field/transport/terms evidence for an
implementation Architecture amendment. This Story does not authorize Codex to
contact the provider.

## 14. Contract and fixture plan

Architecture-approved repository artifacts for a later implementation Story:

- versioned provider-neutral TypeScript contracts;
- JSON Schema for sanitized evidence imports;
- a capability manifest whose default is `OWNER_SUPPLIED_UNKNOWN`;
- synthetic Gaemi-shaped fixtures only after an official export format is
  supplied and licensed for use;
- provider-neutral golden fixtures for quantity-only, custom inspection,
  measurement conflict, barcode/PDF readiness, split shipment, and receipt;
- generated minimal PDF/image fixtures with hashes and no personal data;
- a redaction corpus for tracking, barcode, address, credential, and signed-URL
  leakage;
- contract-drift fixtures that fail closed on unknown fields or changed
  semantics where required.

Fixtures must not be screen-scraped from a live account, contain real orders,
or copy provider documents beyond what copyright and contract permit.

## 15. Test plan for the later implementation

Default CI is network-free and credential-free. Required deterministic tests:

1. capability unknown denies connection and writes;
2. account/customer/provider identifiers remain separated;
3. exact replay is idempotent; changed replay conflicts;
4. count mismatch quarantines affected units;
5. standard quantity inspection never yields quality pass;
6. declared and provider-measured dimensions remain distinguishable;
7. custom full inspection requires exact approved scope and quote reference;
8. missing barcode or attachment/enclosure PDF blocks outbound readiness;
9. split cartons/tracking reconcile without double counting;
10. warehouse shipment never implies Rocket Growth receipt;
11. corrupt, oversized, active-content, wrong-media-type, and hash-mismatched
    documents are rejected;
12. personal-data and secret redaction covers logs/errors/fixtures;
13. partial export, pagination, stale evidence, timeout, 429, auth, provider,
    and response-contract failures remain explicit;
14. no adapter read performs a DB, provider, Wing, supplier, or marketplace
    write;
15. every future write command proves approval binding, idempotency,
    precondition, post-write reconciliation, stop, and recovery separately.

Provider sandbox/read-only smoke is optional and requires owner-approved
credentials, terms, privacy controls, and cost limits. Production smoke is not
authorized by this Story.

## 16. Rollout gates

1. Merge/accept the default inspection policy dependency or reconcile its
   superseding decision.
2. Accept this Architecture Story; still no implementation authority.
3. Collect and review the owner-supplied UNKNOWN register.
4. Amend the contract with the verified transport/export and privacy model.
5. Implement provider-neutral contracts and synthetic fixtures only.
6. Implement a read-only sanitized evidence import against a fake transport.
7. With separate approval, validate a provider sandbox or sanitized owner
   export; no provider writes.
8. Run shadow reconciliation against manually created, non-Production evidence.
9. Design each required provider/Wing write as a separate high-risk/manual
   action Story.
10. Only after exact approvals, execute one bounded SKU experiment with
    quarantine, spend, quantity, and stop caps.

No rollout stage silently grants the next stage.

## 17. Rollback and incident response

### Before external write enablement

Revert or disable the adapter/importer and retain immutable sanitized evidence
needed for audit. Provider and marketplace state are unchanged.

### After any later external write enablement

1. stop new commands and revoke/disable adapter credentials;
2. preserve idempotency, request, response, document-hash, and reconciliation
   evidence without exposing sensitive content;
3. quarantine ambiguous/in-flight units;
4. reconcile provider, carrier, Wing, and Rocket Growth state read-only;
5. require an owner-approved provider-specific recovery action for cancellation,
   return, rework, stock correction, or payment dispute;
6. never delete evidence or claim rollback of a physical shipment.

Physical fulfillment is compensating-action territory, not transactional
rollback. A shipped carton may require interception, return, or quarantine.

## 18. Alternatives rejected

- Hard-code Gaemi workflow into Procurement: couples domain logic to portal,
  Excel, and PDF details and prevents equivalent 3PL substitution.
- Treat the public manual as API documentation: it proves no machine contract,
  auth scheme, automation permission, or SLA.
- Infer quality from standard inbound approval: contradicted by the official
  rate card.
- Automate Wing in the warehouse adapter: crosses a separate marketplace
  account and commerce-write boundary.
- Direct supplier-to-Rocket-Growth by default: lacks independent physical
  evidence for a first-seen SKU.
- Build generalized WMS/ERP persistence now: adds schema/lifecycle scope before
  the first sanitized evidence path is proven.

## 19. Acceptance criteria

This Architecture Story is reviewable when:

- the official flow and price/inspection limitations are source-linked;
- standard quantity inspection is explicitly not a quality guarantee;
- custom exhaustive inspection/processing depends on exact owner-approved
  scope and quote;
- account, quote, customer code, API, webhook, and export mechanisms remain
  `OWNER_SUPPLIED_UNKNOWN`;
- provider-neutral ownership, contracts, evidence, failure, privacy,
  observability, tests, rollout, and rollback are explicit;
- PR #83 is treated as an unmerged dependency and not implementation authority;
- no real account, contact, payment, order, inbound, personal data, secret,
  provider write, or Production action occurred; and
- all later high-risk/manual boundaries remain preserved.

## 20. Proposed next Story

After this Story and its dependency are accepted, the smallest next Story is:

**Gaemi Warehouse Contract Discovery and Sanitized Export Fixture v1**

It may accept an owner-supplied sanitized official field/export specification,
finalize capability states, and add network-free contract fixtures. It must not
connect an account, configure a secret, scrape a portal, create a provider
record, transmit an order, upload a document, request an inbound/outbound, or
perform any Coupang action.
