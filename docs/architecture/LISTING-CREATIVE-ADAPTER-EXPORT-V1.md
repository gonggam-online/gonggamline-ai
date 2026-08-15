# Listing Creative External Adapter Export v1

## Purpose

Provide an authenticated owner boundary for validating an external supplier/WING adapter packet and exporting the exact typed packet needed by the governed Listing Creative Operator. This is an import/validation/export surface; it is not a WING writer and it does not invoke a paid image provider.

## Boundary

- The external adapter remains the authoritative source for WING category metadata, notices, options, filters, rights evidence, asset references, shipping/return fields, and separate approvals.
- The Production adapter-export route accepts one typed `{listingInput, commerce}` packet, validates it with the existing content pipeline, and returns a no-store response.
- The full export may contain confidential commerce fields and is exposed only to an authenticated AAL2 allowlisted admin request with exact origin, JSON content type, CSRF purpose, and rate limits.
- The sanitized review export redacts vendor identity, contact/address/center codes, and asset/rights references. It is not valid Production input.
- No packet, private field, raw WING response, secret, or binary is persisted by this feature. The browser download is a disposable transfer artifact; the owner must store any authoritative copy in an approved remote location.

## Recovery and rollback

The external adapter source/export remains the recovery source. If an older
packet export is unavailable or expired, the operator may use the separate
authenticated re-prepare screen to bind a new packet revision to the current
WING observation and owner approvals. The revision must carry a new packet ID,
evidence evaluation ID/timestamp, source reference, content approval, and a
separate live-write approval reference when applicable. The server verifies
those bindings and then returns the packet to the existing Export validator;
it does not reconstruct facts or private codes from a digest, test fixture, or
legacy draft.

Re-prepare is a no-store transfer boundary. The full packet is not persisted by
this feature, and the external adapter/approved remote handoff remains the
authoritative recovery source. WING submission, paid provider use, asset
publication, and live commerce writes remain separate gates.

Rollback is route/page removal and revocation of the CSRF purpose. No database migration or object-storage mutation is included.

## Non-goals

- No automatic WING submission or product mutation.
- No provider call, paid usage, public image publication, or live-write approval creation.
- No local or Git durable storage of private packet values.
