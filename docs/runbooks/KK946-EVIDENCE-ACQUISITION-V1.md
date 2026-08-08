# KK946 evidence acquisition runbook v1

## Status and authority

- Status: operator-ready, collection not started.
- Subject: `KK946` is an internal candidate reference only. It is not yet
  bound to a supplier item, purchased option, inbound lot, inspected unit, or
  rights-cleared asset.
- Approved parent decision: Listing Content Fact and Policy Contract v1,
  ordered implementation Story 1.
- This runbook authorizes read-only inspection and sanitized status recording
  only. It does not authorize purchasing, uploading, copying private evidence
  into Git, a live Coupang call, category selection, pricing, listing creation,
  approval request, or any commerce write.

The current truthful disposition is `QUARANTINED`. Every missing item remains
`UNKNOWN`; an identifier, URL, screenshot, possession of an image, or supplier
marketing statement never becomes proof by itself.

## Cloud-first evidence boundary

GitHub owns this runbook, the sanitized machine-readable status manifest,
tests, approval history, and recovery instructions. GitHub must not receive
raw invoices, purchase orders, supplier messages, 3PL photos, addresses,
phone numbers, account names, credentials, or unredacted rights documents.

Until a separately approved confidential evidence/asset store and access
policy exists:

1. leave raw evidence in its authoritative supplier, transaction, 3PL,
   registry, or rights-grant source;
2. do not download a unique local-only copy merely to make progress;
3. record only `UNKNOWN` and the required acquisition action in Git;
4. do not record an opaque source reference or digest until an authorized
   operator has verified the exact source and safe recovery path;
5. stop before collecting inspection images or rights documents into a new
   storage location. That is the separately required asset-intake
   Architecture Story.

No new secret, environment variable, database, bucket, local directory, paid
service, or Production access is approved by this runbook.

## Identity crosswalk

All values below are intentionally unresolved. Never copy a guessed value
from the synthetic test fixtures.

| Boundary | Required exact identity | Current | Acceptable authority | Binding check |
|---|---|---|---|---|
| internal candidate | `KK946` | known reference only | repository decision | must remain distinct from every provider ID |
| supplier catalog item | supplier and exact item ID/URL | `UNKNOWN` | timestamped supplier catalog | item page identifies the exact product |
| purchased option/SKU | accepted option/SKU | `UNKNOWN` | purchase order, invoice, or supplier confirmation | option and terms match the catalog item |
| inbound lot | 3PL inbound/lot reference | `UNKNOWN` | 3PL inbound receipt | receipt links to the purchased SKU and quantity |
| inspected unit | unit/sample reference | `UNKNOWN` | timestamped 3PL inspection | inspection identifies method, lot, and exact unit scope |
| source asset | immutable asset digest | `UNKNOWN` | independently created asset or authorized grantor | digest binds the exact bytes reviewed |
| Coupang category | exact display category code | `UNKNOWN` | owner selection plus fresh official metadata | selected category matches admitted product facts |
| seller logistics | outbound and return-center codes | `UNKNOWN` | seller-scoped Coupang read evidence | both codes belong to the same configured vendor boundary |

The crosswalk is complete only when one uninterrupted chain exists:

```text
KK946 -> supplier item -> purchased option/SKU -> inbound lot -> inspected unit
```

A broken, ambiguous, or many-to-many link remains `UNKNOWN` or `CONFLICT` and
cannot release quarantine.

## Exact acquisition sequence

### A. Supplier catalog identity

1. Open the authoritative supplier catalog using the authorized business
   account.
2. Locate the candidate without editing, ordering, messaging, or downloading
   protected assets.
3. Verify supplier identity, exact item identifier, available option/SKU,
   observation time, and whether the page is still available.
4. Keep claims as catalog claims. Do not treat listed dimensions, material,
   origin, certification, stock, price, or images as received-product facts.

Required result: exact catalog item and candidate option, or `NOT_FOUND` /
`AMBIGUOUS`. Do not paste credentials, account identity, full page capture, or
provider response into Codex or Git.

### B. Transaction binding

1. In the authoritative order/invoice system, identify an accepted purchase
   document for the exact catalog item and option.
2. Verify transaction SKU/option, quantity, effective unit price, order time,
   and supplier identity.
3. If no accepted transaction exists, retain `UNKNOWN`; do not place an order
   under this runbook.

Required result: catalog-to-purchased-SKU match. Customer data, payment data,
bank data, addresses, phone numbers, and unredacted document contents remain
outside Git and chat.

### C. 3PL inbound and inspection

1. In the authorized 3PL system, locate the inbound receipt tied to the exact
   transaction SKU and quantity.
2. Verify lot/reference, receipt time, quantity, and exception state.
3. Locate an inspection that names the lot and inspected unit/sample, records
   the inspection method/time, and distinguishes measured observations from
   supplier claims.
4. If an inspection or identity link is absent, retain `UNKNOWN`; this
   runbook does not authorize a new warehouse instruction or paid inspection.

Required result: transaction-to-lot-to-unit chain and scoped observations.
Raw photos and personal/contact data stay in the authoritative 3PL boundary.

### D. Documentary facts and rights

1. For composition, origin, manufacturer, certification, safety, or warranty,
   require an applicable issuer/manufacturer/importer document bound to the
   exact SKU/variant.
2. For every intended image, require exact-byte digest, asserted rights holder,
   grantor authority, Coupang/marketplace use, processor/CDN sharing,
   transformation permissions, territory, term/expiry, revocation, and
   reviewer.
3. Silence, possession, a public URL, or permission to sell the product does
   not prove image use/edit rights.

Required result: independently reviewable documentary and rights authority.
Actual document/asset intake stops until its separate Architecture is approved.

### E. Coupang category and logistics

1. After product identity/facts are admitted, an authorized operator selects
   the candidate Marketplace display category. No code selects it from the
   first search result.
2. A separately authorized owner-triggered read may acquire fresh category,
   outbound, and return-center evidence through the merged GET-only adapter.
3. Never invoke Product Creation, location mutation, asset upload, approval,
   price, or stock writes during evidence acquisition.

Required result: one exact category and same-vendor logistics evidence less
than seven days old. This runbook itself performs no live call.

## Evidence acceptance matrix

| Required fact group | Authority | Scope | Current status | Failure result |
|---|---|---|---|---|
| supplier identity/catalog claims | supplier catalog | catalog item | `UNKNOWN` | quarantine |
| agreed SKU/option/terms | transaction evidence | purchased SKU | `UNKNOWN` | quarantine |
| received and observed facts | 3PL inspection | inbound lot/unit | `UNKNOWN` | quarantine |
| regulated/documentary facts | competent document | exact applicable scope | `UNKNOWN` | quarantine |
| image use/edit rights | rights grant | exact asset digest | `UNKNOWN` | asset prohibited from use |
| category requirements | official metadata + owner selection | catalog item | `UNKNOWN` | preflight incomplete |
| outbound/return centers | seller-scoped GET evidence | configured vendor | `UNKNOWN` | preflight incomplete |

## Sanitized operator return packet

After read-only inspection, return only this shape. Do not attach raw files:

```text
subjectId: KK946
catalogBinding: VERIFIED | NOT_FOUND | AMBIGUOUS | NOT_CHECKED
transactionBinding: VERIFIED | NOT_FOUND | AMBIGUOUS | NOT_CHECKED
inboundBinding: VERIFIED | NOT_FOUND | AMBIGUOUS | NOT_CHECKED
inspectionBinding: VERIFIED | NOT_FOUND | AMBIGUOUS | NOT_CHECKED
documentaryFacts: VERIFIED | INCOMPLETE | CONFLICT | NOT_CHECKED
assetRights: VERIFIED | INCOMPLETE | PROHIBITED | NOT_CHECKED
categorySelection: VERIFIED | INCOMPLETE | NOT_CHECKED
sellerLogistics: VERIFIED | INCOMPLETE | NOT_CHECKED
rawEvidenceMoved: false
commerceWritePerformed: false
notes: sanitized blocker codes only
```

`VERIFIED` must not be recorded until the exact authority, identity chain,
scope, observation time, recovery source, and privacy boundary are confirmed.

## Stop conditions and next gate

Stop immediately for ambiguous identity, absent transaction, unmatched lot,
inspection scope mismatch, documentary conflict, unverified grantor authority,
personal data exposure, request to download raw evidence locally, or any action
that would create an order, paid inspection, location, asset upload, listing,
approval, price, stock, or other write.

When the sanitized return packet is available, Codex can update the status
manifest without copying raw evidence. Inspection-photo and rights-cleared
asset intake remains the next separate Architecture Story. A live Coupang read
requires an exact owner-triggered approval; a live listing remains much later.

## Recovery and rollback

Another authorized PC recovers this runbook and current sanitized status from
GitHub. Raw evidence remains recoverable only from its authoritative business
system until a separately approved store exists. Rollback is a Git revert; no
provider, database, asset, or commerce rollback exists.
