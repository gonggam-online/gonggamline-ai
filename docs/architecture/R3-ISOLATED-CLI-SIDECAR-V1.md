# R3 isolated Supabase CLI sidecar v1

## Decision

Use a one-shot Supabase CLI sidecar with Docker network mode
`container:<approved-db-container>`. The database container remains network
mode `none` with zero published ports. The sidecar shares only that container's
network namespace and reaches PostgreSQL over loopback; it receives no ordinary
Docker or external network.

The host command never contains a database URL or password. A pinned entrypoint
constructs a non-secret loopback locator inside the sidecar. The password is
entered interactively, written to a current-user-only temporary `pgpass` file,
mounted read-only, and deleted in `finally`. This is a narrow clarification of
the R3 prohibition: externally meaningful or credential-bearing database URLs
remain forbidden in host arguments and evidence.

## Supply-chain and runtime controls

- Supabase CLI: `2.110.0` Linux amd64 official release artifact.
- Artifact SHA-256:
  `876f439e85d296bf095d906ca91cadeb5509d753b4d98ee823e5752d578ff92b`.
- glibc runtime base image:
  `debian@sha256:7b140f374b289a7c2befc338f42ebe6441b7ea838a042bbd5acbfca6ec875818`.
  The first Alpine-derived attempt was rejected during live validation because
  the official CLI binary requires glibc; it never connected to the database.
  A second image was rejected because the base lacked the requested OS user;
  the final image creates and pins non-root UID/GID 65532 offline.
- Build uses `--pull=false --network none` after the verified artifact is
  downloaded, then reports the local image ID for the approval record.
- Runtime is read-only, fixed non-root UID/GID `65532:65532`, all capabilities dropped,
  `no-new-privileges`, repository mounted read-only, and `--rm`.
- CLI home and the restricted credential copy live in separate 64 KiB tmpfs
  mounts and disappear with the one-shot container; the root filesystem stays
  read-only.
- Exact repair-plan SHA-256:
  `fc37b1402c76fce8b807b925b8d74d81e66b8665e39f38bbced912d6ee85b34c`.
- Locally built and verified image ID:
  `sha256:13d9fe6fb6790d29c4f816b6cc14ec9271dc91a35f395c4315ecd09df5002128`.
  It reported CLI `2.110.0` under network `none`, read-only root, dropped
  capabilities, `no-new-privileges`, fixed non-root UID, and ephemeral HOME.
- Locally built and verified image ID:
  `sha256:13d9fe6fb6790d29c4f816b6cc14ec9271dc91a35f395c4315ecd09df5002128`.
  It reported CLI `2.110.0` under network `none`, read-only root, dropped
  capabilities, `no-new-privileges`, fixed non-root UID, and ephemeral HOME.
- The runner refuses missing `-ExecuteRepair`, wrong plan fingerprint,
  Production markers, non-`none` network mode, published ports, or a stopped
  target.

## Gates and rollback

Building the sidecar is not a database action. Executing the runner is a
history mutation and requires separate owner approval naming the target
container, source dump hash, sidecar image ID, plan fingerprint, versions
000-022, pre-repair validator evidence, monitoring, and teardown.

Before candidate 023 exists, rollback uses the same pinned sidecar and an
independently approved `migration repair ... --status reverted` plan for the
same versions, followed by exact history/catalog/Product fingerprint checks.
No rollback may replay historical DDL or restore anonymous Product writes.
