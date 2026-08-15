# Listing live-write approval issuance v1

## Purpose

Provide a short, owner-only path for issuing a live-commerce approval after an
external WING adapter packet is refreshed. The approval is a separate authority
from content approval, paid image generation, asset publication, and the final
Coupang/WING write.

## Issuance contract

- The issuer is an authenticated, allowlisted AAL2 administrator acting as the
  owner. The request requires exact origin, JSON, CSRF purpose
  `listing-live-write-approval`, and dedicated rate limits.
- The owner must explicitly confirm `APPROVE_WING_LIVE_WRITE`.
- The request includes the current typed `{listingInput, commerce}` packet and
  revision binding. The packet must not already contain a live approval.
- The server re-evaluates the packet. The only remaining blocker permitted at
  issuance is `LIVE_WRITE_APPROVAL_REQUIRED`; missing required fields, fact
  conflicts, prohibited content, and payload failures remain blocked.
- The server computes an approval target digest from the packet with the live
  approval field normalized to `approved:false` and an empty reference. This
  prevents the approval from silently moving to another product payload.

## Durable state and recovery

Approval records are sanitized JSON manifests in the accepted Supabase private
creative bucket under `listing-creative/live-write-approval/v1/`. They contain
digests, packet/revision identifiers, scope, actor digest, issue time, expiry,
and the server-issued reference. They do not contain vendor IDs, addresses,
phone numbers, raw WING responses, secrets, or packet commerce values. The
private bucket is the remote source of truth; create-only object paths and the
approval digest provide recovery and duplicate protection.

## Binding and downstream use

The returned reference and target digest are inserted into
`commerce.liveWriteApproval` as `approvalReference` and `payloadDigest`, and
the reference is copied into the revision metadata. Re-prepare verifies the
reference/revision match and, when present, verifies `payloadDigest` against the
normalized packet target digest. The approval does not itself call a provider,
publish assets, map a payload, or write WING.

## Expiry and rollback

The issued record expires after 24 hours. A changed packet, evidence timestamp,
content approval, category/policy snapshot, or payload requires a new issuance.
Rollback is route/page removal and revocation of the CSRF purpose; existing
private manifests remain governed evidence and are not copied locally.

## Risk

High-risk/manual. The feature creates a commerce-write approval record and uses
confidential packet data transiently. Database migration, RLS changes, paid
provider calls, public publication, and WING submission remain out of scope.
