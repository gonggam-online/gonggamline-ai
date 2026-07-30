# Orchestrator Phase 0 protocol capability spike

Status: completed locally; manual bootstrap Draft PR required

Base: `a6894fce05480d9b599dcb9a03f9100c607b3fe6`

Branch: `codex/chore/orchestrator-protocol-spike`

## Decision

Use an exec-first vertical slice for the next contract-validator task, but make
Codex App Server stdio the intended controller adapter before Phase 2.

- `codex exec` is the smallest way to prove a structured read-only task and is
  useful as a fallback/recovery command.
- App Server is the safer lifecycle interface for a long-running controller:
  this spike proved explicit thread start/read/resume, streamed usage, and
  `turn/interrupt`.
- On Windows, terminating the `codex.cmd` parent did not terminate its child
  process tree. An exec adapter therefore needs explicit process-tree ownership
  and reconciliation; parent exit alone is not a cancellation proof.
- The canonical ResultContract is valid Draft 2020-12 JSON Schema but is not
  accepted directly by Codex Structured Outputs. A deterministic adapter must
  generate the supported subset and canonical validation must run after model
  output.

This decision does not authorize a durable controller, ledger, router,
workspace-write execution, push/PR automation, or any external write.

## Architecture and safety

The repository owner merged PR #41 at
`a6894fce05480d9b599dcb9a03f9100c607b3fe6` and explicitly authorized Phase 0.
The accepted owner is Engineering Orchestration. This spike introduces no new
Domain, Database, Migration, Queue, Lifecycle, Public API, or external
integration beyond the accepted architecture.

Every execution used `read-only`. The exec run also used `--ephemeral` and
`--ignore-user-config`. Pre/post Git diff hashes matched for structured exec,
exec cancellation, and App Server. Raw logs and generated protocol bundles
remain in temporary local storage and are not committed.

## Installed capability

| Capability | Measured result |
|---|---|
| Codex Desktop bundle | Present, but the WindowsApps executable was not callable from external PowerShell |
| Standalone CLI | Official `@openai/codex`, `codex-cli 0.145.0` |
| Authentication | Existing ChatGPT login; no API key or new credential created |
| `codex exec` | `--json`, `--output-schema`, `--output-last-message`, `--ephemeral`, `--ignore-user-config`, and `--sandbox read-only` present |
| App Server | stdio, WebSocket, Unix/off transports exposed; stdio used |
| Generated protocol | 347 files, 3,303,877 bytes, experimental fields included |
| Generated manifest | `sha256:0dedfab552185dd2dd2e227d1725f68e473902f8542470ba97ed4b751a123ed2` |
| V1 bundle | `sha256:1f66700d1cc3de4a5004e5614a6098878b405c7e7c5f8c9be97fc900d0ad6c68` |
| V2 bundle | `sha256:73b1c05d6657e01d6b9a641d87549e8fb73e110a10554843ccc56c14e4f7a6f9` |

The generated schemas are version-specific and deliberately not committed.
Their hashes and the installed CLI version are the pinning evidence. Phase 1
must regenerate and compare the manifest before accepting a protocol change.

## Structured exec evidence

The first attempts failed closed before model execution and exposed these
Structured Outputs incompatibilities:

1. `oneOf` is rejected.
2. A `const` node must also declare `type`.
3. Every object property must be listed in `required`.
4. `uniqueItems` is rejected.
5. `format: uri` is rejected.

The fixture adapter performs the minimal generation-only transform:

- `oneOf` to `anyOf`;
- add a type to const-only nodes;
- require every declared object property;
- remove `uniqueItems` and `format`.

The model output must then validate against the canonical ResultContract. The
successful adapter schema hash was
`sha256:f39f21f137d2cff65d02fde717f67de99f7853dda671bbca70937800f3173d90`.

Successful run:

- thread: `019fa868-92f1-7262-aca1-93c9a1b69f7d`;
- event types: 1 thread start, 1 turn start, 16 item starts, 19 item
  completions, 1 turn completion;
- usage: 489,921 input, 424,192 cached input, 5,689 output, and 1,478
  reasoning tokens;
- pre/post Git diff hash:
  `72087e26fc36f7d22d2d153cd01fa2dac8f71556`;
- raw JSONL hash:
  `sha256:ab4cd2d8c788b96d99d20d1e79775ecb8d487f69fa903b771b4f8914bfcea15e`.

The CLI did not enforce the TaskContract's 20,000-token test limit. Although
the protocol call and both schema validations succeeded, the canonical task
verdict is therefore `FAILED` / `BLOCKED`, not `COMPLETED`. Budget reservation
and streaming stop policy belong in the controller; a model-produced completion
cannot override this deterministic verdict. ChatGPT auth exposed token usage
but no per-run KRW cost, so `estimatedCostKrw: 0` means "not exposed/no paid
API key", not a verified zero economic cost.

## App Server lifecycle evidence

The stdio fixture proved:

- `initialize` plus `initialized`;
- `thread/start`;
- first `turn/start` through `turn/completed`;
- `thread/read` with one turn;
- `thread/resume` returning the same thread ID;
- a second turn interrupted through `turn/interrupt`;
- final status `interrupted`;
- `thread/tokenUsage/updated` notifications.

Thread `019fa86e-32e0-7233-ad25-9925521d67a4` reported 19,827 input
tokens and 7 output tokens for the completed read-only turn. The summary hash
is `sha256:84264903e3687afee01e161e0079fb752408871a2047aaf38d7df8878c5c6813`.

The committed evidence is an allowlisted summary. Account/rate-limit event
payloads, raw model text, local auth state, and raw stderr are excluded.

## Cancellation and recovery

App Server cancellation is the preferred normal path because it returns a
protocol acknowledgement and a terminal `interrupted` turn.

The exec cancellation probe created thread
`019fa86b-8119-73c1-a511-3c941cc34d3d`. Terminating the `codex.cmd` parent
left its npm Node/native child processes running. They were explicitly
identified and stopped; no probe process remained and the Git diff hash was
unchanged.

Required exec-adapter rule:

1. record parent and child process identity;
2. cancel the entire owned process tree;
3. wait for exit;
4. reconcile JSONL, Git status, and any possible external effect;
5. never infer cancellation from parent exit alone.

## Redaction evidence

The redaction fixture used five synthetic markers covering bearer headers,
query tokens, API keys, cookies, and Windows user paths. All five markers were
removed (`leakedMarkerCount: 0`), summary hash
`sha256:70ef0700c4f0cb8fc3551540456164c1d3299dfd4ccf46a04ac0f6a8fa873971`.

This is a spike, not a production redactor. Phase 1 must use an allowlist-first
event normalizer, test encoded/multiline/provider-specific variants, and never
store raw auth/config payloads in the ledger.

## Contract validation

AJV 8 compiled both schemas in strict Draft 2020-12 mode with
`allowUnionTypes`, and both examples validate:

- `examples/phase-0-protocol-spike.task.json`;
- `examples/phase-0-read-only.result.json`.

The generated Structured Outputs adapter is intentionally weaker than the
canonical schema. Canonical post-validation is mandatory and a generated
result that fails it must become `RETRYABLE_FAILURE` or `FAILED`, never
`COMPLETED`.

## Phase 1 inputs

Phase 1 may begin only through its own approved TaskContract, branch, and PR.
Its minimum inputs are:

1. pin CLI `0.145.0` plus generated manifest hash, while allowing an explicit
   upgrade/review path;
2. implement canonical schema compilation and post-validation;
3. generate the Codex-compatible output schema deterministically;
4. enforce token/wall-time budgets outside the CLI;
5. prefer App Server `turn/interrupt`; retain exec with process-tree cleanup;
6. persist only allowlisted/sanitized events and hashes;
7. treat unknown usage cost, protocol drift, malformed output, or ambiguous
   cancellation as non-success.

## References

- [Architecture](../architecture.md)
- [Workflow](../workflow.md)
- [Approval policy](../approval-policy.md)
- [Implementation roadmap](../implementation-roadmap.md)
- [Task example](../examples/phase-0-protocol-spike.task.json)
- [Result example](../examples/phase-0-read-only.result.json)
- [Exec evidence](../evidence/phase-0-exec.summary.json)
- [App Server evidence](../evidence/phase-0-app-server.summary.json)
- [Cancellation evidence](../evidence/phase-0-exec-cancellation.summary.json)
- [Schema evidence](../evidence/phase-0-schema.summary.json)
