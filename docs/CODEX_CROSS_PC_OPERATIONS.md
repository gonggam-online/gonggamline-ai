# Codex cross-PC operations

## Purpose

The notebook and desktop must behave consistently without copying device-local
Codex conversations. Permanent behavior comes from the Git repository.

## Standard identity

- ChatGPT project: `[HQ]쿠팡월1억매출프로젝트`
- GitHub repository: `gonggam-online/gonggamline-ai`
- Codex project display name: `gonggamline-ai-git`
- local checkout: any safe non-synchronized path on an authorized PC; its path
  is not system identity or durable configuration

The display name may differ from the repository folder without affecting Git,
GitHub, Vercel, Supabase, or marketplace integrations.

## New or replacement PC checklist

1. Install and sign in to Codex, GitHub Desktop or Git, and required runtimes.
2. Clone `gonggam-online/gonggamline-ai` outside OneDrive.
3. Open the cloned folder as the Codex project.
4. Confirm `origin`, `main`, working-tree cleanliness, and the current PR stack.
5. Read `AGENTS.md`, `.ai/README.md`, `.ai/CODEX_OPERATING_STANDARD.md`, and
   `.codex/WORK_STATUS.md`.
6. Install dependencies with the repository lockfile.
7. Run lint, typecheck, tests, and build before treating the PC as ready.
8. Test both notification events:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .codex/notify.ps1 -Event approval
powershell -NoProfile -ExecutionPolicy Bypass -File .codex/notify.ps1 -Event complete
```

9. Run repository lint, typecheck, tests, build, and applicable remote readiness
   gates before treating the PC as equivalent.
10. Confirm no active task depends on a file, database, secret, approval, or
    checkpoint that exists only on the previous PC.

## Daily operating rule

Codex selects or creates a task branch automatically under the permanent
standard. Normal-risk work continues through safe delivery without routine
questions. Production, database, authorization, secrets, real commerce writes,
paid calls, and destructive operations retain manual approval.

Use one branch on one PC at a time. Before moving work to another PC, push a
coherent checkpoint and synchronize the destination PC from GitHub.

All work follows
[Cloud-first durable-state policy](../.ai/CLOUD_FIRST_POLICY.md). Local paths,
Codex conversations, browser sessions, and untracked files are not durable task
state. Existing local backups and automation databases remain migration
blockers until an approved encrypted target and recovery test exist; do not
delete them prematurely.

## Troubleshooting

- Missing past Codex conversations do not block work; recover from Git and
  `.codex/WORK_STATUS.md`.
- If an alert is silent, check Windows volume, the active audio device, and
  whether the terminal session supports sound. The script intentionally exits
  successfully when sound is unavailable.
- If automatic merge does not occur, inspect risk labels, required checks,
  branch protection, review requirements, and GitHub native auto-merge
  availability. Do not bypass them.
- If the working tree contains unexplained changes, stop before switching or
  creating branches and preserve the user's work.
