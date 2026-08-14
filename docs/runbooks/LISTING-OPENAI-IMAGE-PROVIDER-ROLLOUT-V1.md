# Listing OpenAI Image provider rollout v1

## Scope and fixed boundary

This runbook activates the manually merged provider adapter for one authenticated
operator execution. It never authorizes a public generation route, unattended
job, Preview/CI call, arbitrary web or competitor pixel upload, public asset
publication, or WING/Coupang write.

- exact model: `gpt-image-2-2026-04-21`;
- maximum estimated provider cost: USD 2 per product revision;
- maximum six output jobs and two attempts for any one immutable job;
- OpenAI project monthly budget: USD 50 with 50%, 80%, and 100% alerts;
- only `1024x1024`, `1024x1536`, and `1536x1024` are initially admitted because
  the rollout snapshot has deterministic cost evidence for those sizes;
- `OPENAI_API_KEY` is server-only and Production-only. It never enters Git,
  chat, screenshots, logs, a client response, Preview, or CI.

## 1. External project verification

1. In OpenAI Platform, verify organization access and GPT Image organization
   verification for the intended company project.
2. Verify current Image API model availability, Services Agreement, API data-use
   setting, and the official pricing snapshot. A model, terms, ownership, data-
   use, or price drift stops dispatch until a new versioned decision is merged.
3. Configure the USD 50 project monthly budget and alerts. Do not add unrelated
   models, service accounts, or broad organization keys.
4. Create a least-privilege project key and install it directly as
   `OPENAI_API_KEY` in the Vercel `gonggamline-ai` Production environment only.
   Never download or retain a local durable key copy.

## 2. Storage and operator prerequisites

1. Complete `LISTING-CREATIVE-STORAGE-ROLLOUT-V1.md` and prove the private bucket,
   signed review URL, public mirror, takedown, and restore with a synthetic asset.
2. Verify an authenticated admin guard context and a non-empty, audit-owned
   operator approval reference. Browser input alone is not an approval record.
3. For an edit/reference job, resolve every input from the private master and
   require exact digest, `providerUpload=VERIFIED`, the requested edit capability,
   and a positive current image-input token estimate. Observation-only pixels and
   unknown capabilities fail before the API transport.

## 3. Bounded synthetic smoke

After the provider PR is manually merged, run one fact-only synthetic product
request. Confirm the request pins the exact model, uses no input pixels, has a
deterministic idempotency hash, stays below the revision cap, returns exactly one
PNG, and records only prompt/request digests, hashed provider request reference,
usage, cost, dimensions, MIME, and byte digest. Quarantine the output from all
marketplace and public-delivery paths, then archive/remove it according to the
synthetic restore drill.

## 4. Product execution

Reserve the immutable storage job before any paid call. Generate no more than the
selected candidate plan requires. Provider success is not deployment success:
actual-byte QA, exact-product representation review, selected-candidate content
approval, private archive, and digest-verified public mirror must all pass in the
later QA/approval PR. Live-write approval remains separate.

## Rollback

Stop dispatch, revoke or rotate `OPENAI_API_KEY`, remove public mirrors first,
invalidate dependent content approvals, preserve governed private evidence,
revert the provider PR, and verify that no WING payload references a revoked
digest. Provider spend cannot be undone and therefore remains bounded before the
request.
