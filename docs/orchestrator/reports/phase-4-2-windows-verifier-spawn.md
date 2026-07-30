# Phase 4.2 Windows verifier process boundary

## Root cause

On Windows with Node 24, `spawnSync("npm.cmd", ..., { shell: false })` returns
`EINVAL` before starting npm. The controller therefore recorded an empty-output
verification failure even when the same lint command passed interactively.

## Fix

The verifier now launches only its existing allowlisted npm commands through
the Windows command processor:

```text
cmd.exe /d /s /c npm.cmd <fixed approved arguments>
```

The command name and every argument remain controller-owned constants. No
TaskContract field, Worker output, or user string can add a command.
Non-Windows execution remains unchanged.

## Validation

- focused Phase 2 verifier tests, including platform invocation;
- real controller-owned `LINT` execution on Windows;
- typecheck, full repository tests, lint, Production build, and diff checks.

This change adds no Product, database, Auth, Production, secret, or commerce
boundary.
