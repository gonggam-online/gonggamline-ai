# Codex cross-PC operating standard

This document is binding on every local Codex/Work installation that opens this
repository. The repository, not a device-local Codex conversation, is the
durable source of project instructions and delivery state.

## 1. Session boot and task recovery

1. Read `AGENTS.md`, `.ai/README.md`, this file, relevant domain policies, and
   `.codex/WORK_STATUS.md`.
2. Inspect the working tree, current branch, remote, open PR stack when
   available, and recent commits before planning changes.
3. Recover work from repository evidence. Do not depend on prior device-local
   conversation history.
4. Preserve user changes and stop before branch selection if the working tree
   contains unexplained overlapping changes.

## 2. Automatic branch selection

The user does not need to provide a branch name.

1. If the current non-`main` branch clearly matches the requested task and its
   worktree is safe, continue it.
2. Otherwise, find an existing local or remote task branch only when its name,
   commits, and PR purpose unambiguously match the request.
3. If no matching branch exists, create `codex/<type>/<task-slug>` from the
   correct base:
   - latest `origin/main` for independent work;
   - the tip of an explicitly required open dependency for stacked work.
4. Never implement directly on `main`, silently reuse an unrelated branch,
   rewrite history, force-push, or delete a branch.
5. If the base is ambiguous or the working tree is unsafe, request owner
   direction instead of guessing.

Recommended types are `feat`, `fix`, `chore`, `docs`, and `test`.

## 3. Autonomous delivery and approval boundary

For normal-risk work, proceed without routine approval through investigation,
implementation, validation, commit, push, PR creation/update, Preview
verification, and native auto-merge when every required gate passes.

Do not bypass platform approvals, repository protection, review requirements,
or missing credentials. The following remain manual/high-risk:

- Production, schema, migration, database data, RLS, auth, or authorization;
- secrets, environment configuration, OAuth, billing, or paid calls;
- marketplace listing, price, procurement, order, inventory, fulfillment,
  return, settlement, payment, or other real commerce writes;
- destructive, irreversible, bulk, or externally consequential actions;
- any action classified high-risk by `.ai/RISK_POLICY.md`.

High-risk PRs receive `manual-merge-required`, never auto-merge, and must include
rollback and owner action. Normal-risk PRs may receive `normal-risk` and use the
repository's native safe auto-merge workflow only after all gates pass.

## 4. Korean progress communication

User-facing progress and outcome summaries default to Korean. Preserve English
where required for source code, filenames, commands, identifiers, API
contracts, logs, commit messages, and PR titles.

For a substantial task:

1. Plan 8–15 verifiable steps.
2. Calculate progress as `completed steps / total steps × 100`.
3. Report at task start, meaningful checkpoints, before an approval boundary,
   and at terminal completion. Do not generate updates so frequently that they
   slow implementation.
4. Never report elapsed-time guesses or describe incomplete work as complete.
5. Keep `.codex/WORK_STATUS.md` consistent with the same completed/current/
   blocked state.

Small tasks may use a shorter step list while retaining evidence-based
percentages.

## 5. Local Windows notification

Use the repository script from the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .codex/notify.ps1 -Event approval
powershell -NoProfile -ExecutionPolicy Bypass -File .codex/notify.ps1 -Event complete
```

- `approval`: immediately before a genuinely blocking owner-approval request.
- `complete`: after implementation, required validation, and applicable
  delivery have reached their actual terminal state.
- Do not play completion for a blocked or partially completed task.
- A muted device, unavailable audio session, or script failure must not alter
  repository state or block delivery.

## 6. Cross-PC consistency

- GitHub is the code and branch source of truth.
- `AGENTS.md`, `.ai/`, `.codex/`, and tracked operating documentation are the
  instruction source of truth.
- Secrets remain in approved secret stores or local untracked environment
  files, never in repository instructions.
- Before switching PCs, commit/push coherent work or record the exact safe
  recovery state in `.codex/WORK_STATUS.md`.
- Never work on the same branch concurrently from two PCs.
- A new PC is ready only after remote identity, clean status, branch state,
  required runtime/tooling, and project validation are confirmed.

## 7. Capability limits

Repository instructions can standardize Codex behavior, but cannot grant OS,
GitHub, Supabase, Vercel, or Codex platform permissions. They also cannot
guarantee audible sound on muted or unsupported devices. Never describe these
limits as successfully automated unless verified in the active environment.
