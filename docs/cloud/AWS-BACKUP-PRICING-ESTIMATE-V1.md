# AWS Backup Production and Pricing Evidence v1

## Decision

The merged Production baseline is healthy and the proposed Singapore independent
backup architecture remains below the owner-approved AWS-only ceiling. The
public On-Demand AWS Pricing Calculator reports USD 2.22/month for the observed
scenario and USD 2.63/month for the 2x stress scenario. Adding a fixed USD 2.00
tax and uncertainty reserve produces the binding ceiling assessment of USD
4.63/month, leaving USD 5.37/month below the USD 10 ceiling.

This evidence satisfies the Calculator prerequisite only. It does not authorize
an AWS stack, change set, paid resource, credential, Production export/upload,
restore, or schedule.

## Production verification after PR #100

- Merge commit: `bb0e3715159cfe7f7d8c3bf049189f7e94c5918b`.
- Production URL: `https://gonggamline-ai.vercel.app`.
- The Product Ops page rendered against the Supabase live-data path and showed
  151 current products. No mutation control was used.
- GitHub Production browser smoke run:
  `https://github.com/gonggam-online/gonggamline-ai/actions/runs/31055725712`.
- Exact-head job: `production-browser-smoke`, successful in 1 minute 42
  seconds. The workflow exercised the Production pages and APIs and retained
  console, page-error, and failed-request assertions.
- Evidence artifact: `production-browser-evidence`, artifact ID `8950182689`,
  21.2 MB, digest
  `sha256:dc187455eae7465f2c6d13f4c7c56876257e042ad929761cc60d1c764eb9de70`.
- The only observed workflow warning is the announced GitHub Actions Node.js 20
  to Node.js 24 runtime transition. It did not fail the application checks.

## Calculator boundary

- Pricing date: 2026-08-06.
- Pricing mode: public On-Demand, no negotiated discount.
- Region: Asia Pacific (Singapore), `ap-southeast-1`.
- Currency: USD.
- AWS Calculator tax treatment: tax is excluded.
- Supabase Pro cost is excluded because the accepted ceiling applies only to
  the independent AWS backup layer.
- Lambda is modeled without free-tier discounts so the decision does not depend
  on account-level free-tier eligibility.

| Service | Observed input | Observed USD/month | 2x stress input | Stress USD/month |
| --- | --- | ---: | --- | ---: |
| Amazon S3 Standard | 0.033608337 GB-month, 32 writes, 1 read | 0.00 | 0.067216674 GB-month, 64 writes, 2 reads | 0.00 |
| AWS KMS | 1 customer-managed key, 100 symmetric requests | 1.00 | 1 key, 200 requests | 1.00 |
| Amazon ECR | 1 GB private image | 0.10 | 2 GB private image | 0.20 |
| AWS Lambda | 32 calls, 60 seconds, 512 MB, free tier excluded | 0.02 | 32 calls, 120 seconds, 512 MB, free tier excluded | 0.03 |
| AWS Secrets Manager | 1 secret, 32 API calls | 0.40 | 1 secret, 64 API calls | 0.40 |
| EventBridge Scheduler | 32 actual calls; 1 million Calculator minimum | 0.00 | 32 actual calls; 1 million Calculator minimum | 0.00 |
| Amazon SQS | 100 actual requests; 1 million Calculator minimum | 0.40 | 200 actual requests; 1 million Calculator minimum | 0.40 |
| Amazon CloudWatch | 1 custom health metric | 0.30 | 2 custom health metrics | 0.60 |
| **Calculator total** | | **2.22** | | **2.63** |

The EventBridge Scheduler and SQS rows accept whole millions in the public
Calculator. Entering the minimum value of one million intentionally overstates
the planned 32 Scheduler calls and 100/200 SQS requests. CloudTrail data events
are excluded because they are not enabled. Sanitized CloudWatch log volume,
small restore retrieval, small data transfer, price rounding, and tax remain
uncertain and are covered by the fixed USD 2.00 reserve.

The CloudWatch Calculator summary may display unrelated default mobile OTEL
fields. Only the explicit one-metric and two-metric inputs are part of this
decision, and their displayed costs are USD 0.30 and USD 0.60 respectively.

## Public estimate evidence

- Observed scenario: [AWS Calculator estimate](https://calculator.aws/#/estimate?id=baaee22d4bbe558234a8b8e07d8a08c854e58a83).
- 2x stress scenario: [AWS Calculator estimate](https://calculator.aws/#/estimate?id=67720a4897977a644ddf0cbdbf7f43ee0bf99b48).

The links contain sanitized planning inputs only. AWS states that a shared
estimate is stored on public servers, is accessible to anyone with its
unguessable link, and expires after one year. No account identifier, credential,
database URL, backup content, customer row, or secret is present.

## Ceiling calculation

| Item | USD/month |
| --- | ---: |
| 2x stress Calculator subtotal | 2.63 |
| Fixed tax and uncertainty reserve | 2.00 |
| **Binding ceiling assessment** | **4.63** |
| Owner-approved ceiling | 10.00 |
| **Remaining headroom** | **5.37** |

The USD 2.00 reserve is a planning allowance, not a statement of a particular
tax rate. It is deliberately larger than the currently unmodeled low-volume
surfaces. Any later architecture change, enabled CloudTrail data events,
material backup growth, cross-region transfer, or Calculator total above USD
8.00 requires a refreshed estimate before provisioning or continued operation.

## Remaining gates

1. The 2026-08-06 synthetic complete-worker rehearsal closed the Lambda
   capacity prerequisite with a 6,351,131-byte archive, 7.901-second complete
   workflow, and 6,351,837-byte peak ephemeral use. Eligibility is limited to
   `ELIGIBLE_FOR_DISABLED_WORKER_CHANGE_SET_REVIEW_ONLY`.
2. Review the exact disabled-worker CloudFormation change set under a separate
   high-risk owner approval.
3. Approve first Production export/upload separately.
4. Complete two isolated restore cycles before remote parity or local-backup
   decommission can be claimed.

## Official references

- [AWS Pricing Calculator getting started](https://docs.aws.amazon.com/pricing-calculator/latest/userguide/getting-started.html)
- [Sharing an AWS Pricing Calculator estimate](https://docs.aws.amazon.com/pricing-calculator/latest/userguide/save-share-estimate.html)
- [Exporting an AWS Pricing Calculator estimate](https://docs.aws.amazon.com/pricing-calculator/latest/userguide/export-estimate.html)
