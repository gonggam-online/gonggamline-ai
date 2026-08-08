# Cloud-first durable-state policy

## Permanent principle

GonggamLine is designed for complete cloud-portable operation. An authorized
operator must be able to resume development, verification, maintenance, and
operations from another PC without depending on a unique local file, an old
Codex conversation, or device-specific application state.

Local PCs are execution clients, not durable system hosts. A local checkout,
dependency cache, build output, browser artifact, and isolated disposable
rehearsal are temporary and replaceable. Durable project state must have one
approved remote source of truth and a verified recovery path.

This principle applies before feature and storage convenience, but never
overrides revenue priority, security, privacy, data residency, least privilege,
cost control, Production safety, or manual approval boundaries.

## Durable-state placement

| State | Authoritative location | Local use |
|---|---|---|
| source, migrations, contracts, policy, task recovery | GitHub repository, branches, PRs, tracked files | replaceable checkout only |
| validation and delivery evidence | GitHub Actions, PR checks, approved CI artifacts, Vercel Preview | temporary reproduction only |
| application and operational data | approved managed database, initially Supabase where accepted | sanitized disposable fixture only |
| binary assets and evidence | approved encrypted object storage with retention/access policy | bounded cache only |
| secrets and environment configuration | approved Vercel, GitHub, Supabase, or accepted secret manager | temporary injection only |
| backups and disaster recovery | approved encrypted cloud backup in a separate recovery boundary | temporary restore rehearsal only |
| automation tasks, leases, checkpoints, audit | approved managed transactional store | no device-unique durable ledger |
| operator decisions and approvals | GitHub PR/issue/Decision Log or approved record system | no conversation-only authority |

OneDrive, consumer file synchronization, personal email, chat attachments,
unreviewed SaaS storage, and local disks are not approved durable sources of
truth. Git is not a database, secret store, Production dump store, or raw
business-data archive.

## Mandatory Story gate

Before implementation, every Story records:

1. durable state created, read, changed, or removed;
2. authoritative remote service and owner for each state;
3. classification: public, internal, confidential, secret, personal, or
   Production business data;
4. encryption, least privilege, retention, deletion, backup, and recovery;
5. cross-PC bootstrap and recovery verification;
6. local temporary artifacts, purpose, location class, and cleanup condition;
7. cost, vendor dependency, outage behavior, and rollback.

Implementation stops when a new durable state has no approved remote owner,
when recovery is untestable, or when cloud placement would expose protected
data. Codex must not invent a bucket, database, secret, environment variable,
account, region, retention period, or access policy to make the gate pass.

## Local storage rule

Allowed local state is limited to a replaceable Git checkout, reproducible
dependencies/build caches, ignored active test output, sanitized fixtures, and
explicitly approved disposable database/restore rehearsals with cleanup and no
Production fallback.

The following are prohibited as new local-only durable state:

- business, product-evidence, customer, order, or settlement records;
- authoritative backups;
- automation ledgers, leases, checkpoints, or approvals;
- credentials or secret exports;
- unique generated operational assets; and
- the only copy of an uncommitted multi-step task.

Do not delete or move existing local backup or sensitive state until target
architecture, encryption, access, retention, checksum, restore test, and owner
approval are complete. Until then it is a recorded migration blocker, not an
accepted long-term source of truth.

## Session and checkpoint behavior

- Start from fetched `origin/main`; never assume the current PC is current.
- Use one task branch on one PC at a time and push coherent checkpoints before
  switching device or stopping substantial work.
- `.codex/WORK_STATUS.md` records remote branch, commit, PR, current step,
  blocker, external dependency, and recovery context.
- A task is not recoverable while its only meaningful state is an unpushed
  commit, untracked file, local database, local conversation, or app session.
- Never upload a local artifact merely to make it remote. Classify and approve
  the destination first.

## Cloud service decision order

Reuse an accepted boundary before adding a provider:

1. GitHub for source, review, workflow, and bounded engineering evidence;
2. Vercel for deployment and environment-scoped runtime secrets;
3. Supabase for accepted Postgres/Auth/Storage capabilities;
4. a new managed service only through an Architecture Story proving ownership,
   region, security, recovery, cost, exit, and deletion behavior.

No feature may silently fall back from an unavailable managed service to local
durable storage. Local development fallbacks must be synthetic, visible,
non-authoritative, and tested.

## Migration order

Cloud portability is incremental and must not block the shortest safe revenue
path:

1. enforce policy and Story/Task gates;
2. inventory local durable dependencies and assign owner/target;
3. make bootstrap and verification reproducible;
4. establish encrypted off-device backups and restore evidence;
5. move automation state and unique assets to approved managed stores;
6. remove local-authoritative paths after parity/recovery tests;
7. validate a clean authorized-PC recovery drill.

Database, backup, secret, Production, personal-data, or automation-state moves
remain separately scoped high-risk/manual Stories. This policy authorizes their
design and inventory, not execution.

## Completion criteria

A fresh authorized PC must recover the repository and active task, install
pinned tooling, access only permitted secrets, run required checks, reach
managed services, and continue delivery without files from the previous PC.
Recovery must also succeed when the previous PC is unavailable.
