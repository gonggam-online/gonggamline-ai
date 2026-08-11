# GonggamLine Central Runner

The desktop runner is the only component that receives Coupang credentials.
The notebook/PixTil producer sends versioned requests through AWS SQS and never
receives the Coupang access key, secret key, or vendor ID.

Initial allowed operations are read-only:

- `COUPANG_CONNECTION_TEST`
- `COUPANG_CATEGORY_META`

Listing, price, inventory, order, return, settlement, and payment writes are
rejected by the request contract. They require separate architecture,
idempotency, approval, reconciliation, and loss-limit gates.

AWS uses two encrypted queues plus dead-letter queues. The desktop permission
may receive/delete request messages and send responses. The notebook permission
may send requests and receive/delete responses. Neither permission includes IAM,
CloudFormation, Secrets Manager, S3, or unrestricted SQS actions.

The Windows scheduled task starts at user logon, restarts after one minute, and
the worker applies capped exponential backoff. Expired AWS SSO authentication
fails closed until the operator signs in again.

For long-term operation, install the scheduled task from the durable main
checkout after this change is merged. Do not leave the task pointing at a
temporary Codex worktree.

Secrets are entered interactively by the owner with
`scripts/central-runner-credential.ps1 -Action Set`, encrypted with Windows
DPAPI `CurrentUser`, and stored in a current-user-only local file. They are
injected only into the worker child process and are never written in plaintext
to repository files or logs.
