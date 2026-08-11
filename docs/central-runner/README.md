# GonggamLine Central Runner

The desktop runner is the only component that receives Coupang credentials.
The notebook/Picktil Discovery producer sends versioned requests through AWS SQS and never
receives the Coupang access key, secret key, or vendor ID.

Contract `1.0.0` uses `wing.read.request` and `wing.read.response`. Initial
allowed operations are read-only:

- `connection_test`
- `list_seller_products`
- `category_meta`

Listing, price, inventory, order, return, settlement, and payment writes are
rejected by the request contract. They require separate architecture,
idempotency, approval, reconciliation, and loss-limit gates.

AWS uses two encrypted FIFO queues plus FIFO dead-letter queues in
`ap-northeast-2`. Picktil Discovery 09-cloud-platform Terraform is the sole
infrastructure source of truth. `infra/central-runner/cloudformation.json` is a
legacy consumer reference only and must not be deployed or extended for these
queues. The desktop permission may receive/delete request messages and send
responses. The notebook permission
may send requests and receive/delete responses. Neither permission includes IAM,
CloudFormation, Secrets Manager, S3, or unrestricted SQS actions.

The Windows scheduled task starts at user logon, restarts after one minute, and
the worker applies capped exponential backoff. Expired AWS SSO authentication
fails closed until the operator signs in again.

The worker keeps a local SQLite processed-request replay cache under the current
user profile by default. It stores no credentials, vendor ID, or raw provider
error body. A completed duplicate republishes the same normalized response and
does not call WING again. An interrupted prior execution fails closed rather
than repeating WING. This cache is not a business source of truth; loss may
repeat a read but cannot produce a commerce write.

Actual queue URLs are supplied only through
`CENTRAL_RUNNER_REQUEST_QUEUE_URL` and `CENTRAL_RUNNER_RESPONSE_QUEUE_URL`.
`CENTRAL_RUNNER_LEDGER_PATH` may override the current-user default with an
absolute path. Repository examples use names only and contain no URL or ARN.

For this contract, do not run the legacy
`configure-central-runner-sso.ps1` or
`provision-central-runner-permissions.ps1` to create queue ownership. Picktil
09 supplies the deployed queue URLs/ARNs and the user-designated laptop role.

For this contract, do not run the legacy
`configure-central-runner-sso.ps1` or
`provision-central-runner-permissions.ps1` to create queue ownership. Picktil
09 supplies the deployed queue URLs/ARNs and the user-designated laptop role.

For long-term operation, install the scheduled task from the durable main
checkout after this change is merged. Do not leave the task pointing at a
temporary Codex worktree.

Secrets are entered interactively by the owner with
`scripts/central-runner-credential.ps1 -Action Set`, encrypted with Windows
DPAPI `CurrentUser`, and stored in a current-user-only local file. They are
injected only into the worker child process and are never written in plaintext
to repository files or logs.

## Current deployment identifiers

The implementation does not infer deployment identity. As of 2026-08-11 in
the inspected environment:

- AWS SSO start URL: `UNCONFIRMED`;
- AWS SSO region: `UNCONFIRMED` (runner target region is `ap-northeast-2`);
- caller account: `UNCONFIRMED`;
- current caller role/principal ARN: `UNCONFIRMED`;
- historical repository permission-set name: `GonggamCentralRunnerDesktop`
  (not verified as the current caller);
- laptop role `공감센트라런너랩톱 최소권한` exact ARN: `UNCONFIRMED`.

These are runtime blockers, not values to guess. The final single
`connection_test` remains disabled until exact local configuration evidence is
available.

## Current deployment identifiers

The implementation does not infer deployment identity. As of 2026-08-11 in
the inspected environment:

- AWS SSO start URL: `UNCONFIRMED`;
- AWS SSO region: `UNCONFIRMED` (runner target region is `ap-northeast-2`);
- caller account: `UNCONFIRMED`;
- current caller role/principal ARN: `UNCONFIRMED`;
- historical repository permission-set name: `GonggamCentralRunnerDesktop`
  (not verified as the current caller);
- laptop role `공감센트라런너랩톱 최소권한` exact ARN: `UNCONFIRMED`.

These are runtime blockers, not values to guess. The final single
`connection_test` remains disabled until exact local configuration evidence is
available.
