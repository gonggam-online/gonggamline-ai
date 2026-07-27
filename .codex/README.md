# Codex engineering workspace

This directory is the restartable control plane for repository work.

1. Copy `TASK_TEMPLATE.md` into the issue or task description.
2. Start from `SESSION_TEMPLATE.md`, classify risk with `.ai/risk-classification.md`, and update `WORK_STATUS.md`.
3. Diagnose with `ROOT_CAUSE_TEMPLATE.md`; do not patch code before external configuration and database causes are excluded.
4. Apply `CHANGE_POLICY.md` and `REVIEW_CHECKLIST.md`.
5. Use `USER_ACTION_TEMPLATE.md` whenever an owner must change an external system.
6. Apply [the cross-PC operating standard](../.ai/CODEX_OPERATING_STANDARD.md)
   for automatic branch selection, delivery boundaries, Korean progress, and
   Windows notifications.
7. Use `notify.ps1 -Event approval` before a blocking owner action and
   `notify.ps1 -Event complete` at genuine terminal completion.

`WORK_STATUS.md` is live state, not a historical log. Changelogs and commits remain the permanent history.
