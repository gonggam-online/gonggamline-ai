# External Commerce Asset Discovery and Rights Policy v1.1

## Decision and authority

- Status: owner-accepted policy amendment on 2026-08-14 through delegated task `12D`.
- Policy owner: Listing domain governance. Seller remains the only owner of a later marketplace publication or listing write.
- Amends: Listing Content Fact and Policy Contract v1 and the Listing Content/Conversion owner amendment v1.
- Delivery classification: normal-risk, documentation only.
- Runtime authority granted: none. This amendment does not authorize crawling, downloading source bytes, uploading assets, paid generation, external API use, database/queue work, Production access, or a marketplace write.

The revenue objective is to find useful supplier, manufacturer, wholesale, and public-market references quickly without falsely treating public availability as commercial reproduction or editing permission. Discovery/Collection and Publication/Derivative authorization are separate decisions.

> Broad discovery is allowed, but this is not blanket permission to publish rights-uncleared public material on Coupang.

## Binding legal and provider boundary

This is an operational evidence policy, not a declaration of legal ownership or legal advice.

- A public URL, wholesale-site listing, login-visible asset, purchase, or file possession does not by itself prove commercial reproduction, distribution, sublicensing, processor delivery, or derivative rights.
- The reviewed [Domeggook membership terms](https://domeggook.com/binary/Doc/member_clause.pdf) place responsibility for member-provided information and third-party-rights compliance on users/sellers and prohibit rights-infringing conduct. They are not a platform-wide license for copying seller-created material.
- The reviewed [Korean Copyright Act](https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=92099) reserves reproduction and derivative-work rights to the rightsholder, subject to applicable law. Publication/edit authorization therefore needs scoped evidence; it is never inferred from online visibility.
- Terms, robots rules, access controls, privacy, publicity, trademark, design, character, advertising, and marketplace rules remain independently binding.

## Three independent lanes

### 1. `ASSET_DISCOVERY_ALLOWED`

Discovery may record minimal reference metadata for a publicly reachable or properly authorized source: source URL/type; platform, supplier, manufacturer, seller, product and asset identifiers; observation time and retrieval context; exposed content type/dimensions/duration; a bounded thumbnail or digest only where permitted; and the observed rights notice or contact/grant path.

Discovery must respect robots directives, applicable terms, rate limits, privacy, paywalls, and access controls. It must not bypass login, anti-bot, CAPTCHA, technical controls, or authorization scope. Broad or automated crawl, bulk download, authenticated collection, and source-byte retention require a separate provider-contract, rate-limit, security, storage, and risk gate. Discovery metadata is a locator and research record, not a rights grant. Where terms or technical rules prohibit even reference capture, discovery stops.

### 2. `SUPPLIER_RESALE_ASSET_FAST_PATH`

An exact asset may move quickly to eligible use only when a verifiable grant is bound to the exact supplier/manufacturer, product/variant, and asset digest. Accepted evidence is an explicit platform reseller-use label/control, exact seller/supplier permission, manufacturer distribution license/brand portal grant, or contract/durable message/file metadata identifying the grantor, asset, and scope.

The evidence record separates `use` from each `editOperation`. It records channel, territory, start/end or review date, revocation/cancellation terms, processor/CDN delivery, attribution/third-party notice, grantor authority, evidence reference, digest, reviewer, and decision time.

`USE_ALLOWED` never implies crop, expression-changing resize, background removal, overlay, translation, compositing, generative reference, animation, or video extraction. Only expressly allowed operations pass. A verified unchanged original may remain eligible while unsupported derivatives are `DERIVATIVE_UNAVAILABLE`.

### 3. `PUBLIC_REFERENCE_ONLY`

Public images and videos without a scoped rights grant remain useful research candidates for competitor positioning, information hierarchy, composition, use-scene needs, and customer questions. They cannot be promoted to a Production publication manifest or supplied to a generative/editing provider as source material without separate authority.

Teams may learn facts, ideas, functional requirements, and unprotected patterns while avoiding reproduction of protected expression. Convert through independently commissioned/in-house photography, rights-cleared 3PL photography, verified supplier/manufacturer assets, or independently generated content whose provider terms, inputs, product facts, and third-party rights pass their own gates. Ambiguous similarity or third-party-rights risk requires review before publication.

## No premature quarantine

Rights status is asset- and operation-specific. `UNKNOWN` rights block only that asset's publication and unsupported derivative lane. They do not by themselves quarantine product identity/fact acquisition; keyword, title, customer-question, use-case, or story research; category/competitor-pattern analysis; alternative-source discovery; or a listing packet that excludes the blocked asset and otherwise passes.

The evaluator should propose, in order, a verified unchanged supplier asset, manufacturer grant, rights-cleared 3PL photo, independent photography, or independently generated alternative. Product-level quarantine remains appropriate for an unresolved core identity/fact conflict, required field, selected prohibited content, payload failure, or missing live-write approval.

## Prohibited conduct

- bypassing access controls, authentication scope, paywalls, robots rules, or anti-bot controls;
- removing or concealing watermarks, ownership marks, provenance, or rights notices;
- unauthorized use of people, personal data, competitor marks, packaging, characters, or other third-party protected material;
- source laundering, fabricated provenance/licenses, digest substitution, or claiming independent creation from a copied source;
- ignoring takedown, expiry, revocation, or scope reduction; and
- using discovery approval as publication, derivative, upload, paid-provider, or commerce-write approval.

## Revocation, expiry, and takedown

Every published asset manifest must retain source and derivative digests plus dependency edges. A takedown, expiry, revocation, grantor-authority failure, or policy change triggers digest-based impact lookup, immediate unpublication or replacement, cache/CDN handling under the approved service contract, evidence preservation, and review of dependent derivatives. It does not erase the audit record or silently substitute bytes.

## Cloud-first durable-state gate

| Durable state | Approved remote authority | Classification / recovery |
|---|---|---|
| policy, sanitized schemas, decision and task evidence | GitHub branch/PR and merged repository | internal; fresh authorized checkout |
| source URLs and bounded reference metadata | not approved here; future managed evidence service required | public/internal/confidential; no local-only archive |
| license evidence, digests, manifests and approvals | not approved here; encrypted least-privilege managed evidence/object service requires an Architecture Story | often confidential; approve retention/deletion/backup/recovery first |
| sensitive documents and original binaries | source provider or future approved encrypted object service | never upload to GitHub merely for portability |

Local browser state and bounded review screenshots/build/test output are disposable. No new local asset archive, rights ledger, or unique approval store is allowed. Because the durable operational store is not approved, this PR defines policy only and cannot implement collection or intake.

## Downstream dependency contract

Workrooms 15, 15A, 15B, 15C, 16A, 16B, 20, and 22 must consume this policy before implementing discovery, generation, registration, learning, or publication. They must preserve separate discovery/use/edit decisions; exact-grant fast paths; `PUBLIC_REFERENCE_ONLY` exclusion from publication; asset-lane rather than premature product quarantine; digest revocation/takedown handling; Cloud-first approval before durable collection; and every external, paid, database, queue, Production, and commerce-write gate.

Any later Domain, API, database, queue, crawler, downloader, asset store, provider integration, or publication implementation is a separate Architecture Story and may be high-risk/manual even though this documentation amendment is normal-risk.

## Acceptance and rollback

Owner acceptance is the delegated 12D policy decision dated 2026-08-14. It accepts policy semantics only, not execution authority. Rollback is Git revert; already published assets would still require takedown/reconciliation rather than relying on a repository revert.
