# GonggamLine Central Runner

The desktop runner is the only component that receives Coupang credentials.
The notebook/Picktil Discovery producer sends versioned requests through AWS
SQS and never receives the Coupang access key, secret key, or vendor ID.

Contract `1.0.0` uses `wing.read.request` and `wing.read.response`. Allowed
operations are read-only:

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
queues. The desktop permission may receive/delete requests and send responses.
The notebook permission may send requests and receive/delete responses. Neither
permission includes IAM, CloudFormation, Secrets Manager, S3, or unrestricted
SQS actions.

The worker is intentionally stateless. SQS FIFO explicit deduplication is the
remote duplicate-suppression boundary. SQS delivery remains at-least-once, so a
crash after a read can repeat that read. This is safe only because every allowed
operation is read-only. No product response or automation ledger is persisted
on the desktop.

Actual queue URLs are supplied only through
`CENTRAL_RUNNER_REQUEST_QUEUE_URL` and `CENTRAL_RUNNER_RESPONSE_QUEUE_URL`.
Repository examples use names only and contain no URL or ARN. For this contract,
do not run the legacy `configure-central-runner-sso.ps1` or
`provision-central-runner-permissions.ps1` to create queue ownership. Picktil 09
supplies the deployed queue URLs/ARNs and the user-designated laptop role.

The Windows scheduled task starts at user logon, restarts after one minute, and
the worker applies capped exponential backoff. Expired AWS SSO authentication
fails closed until the operator signs in again. For long-term operation, install
the scheduled task from the durable main checkout after this change is merged;
do not leave it pointing at a temporary Codex worktree.

Secrets are entered interactively by the owner with
`scripts/central-runner-credential.ps1 -Action Set`, encrypted with Windows
DPAPI `CurrentUser`, and stored in a current-user-only local file. They are
injected only into the worker child process and are never written in plaintext
to repository files or logs.

Runtime identity, queue access, encryption, redrive, and the final read-only
`connection_test` must be verified externally before cutover. Do not commit
actual queue URLs, ARNs, credentials, public IPs, or session identifiers.
