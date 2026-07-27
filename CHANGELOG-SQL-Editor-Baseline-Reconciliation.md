# SQL Editor baseline reconciliation

## 2026-07-27

- Preserved seven operator-supplied SQL Editor entries outside the executable
  migration directory.
- Mapped diagnostic, DDL, RLS, and verification entries to the Git migration
  chain.
- Documented dependency-based replay order, unresolved timestamp evidence, and
  the separation between historical RLS fidelity and Production security.
- No migration, application behavior, deployed database, or Git history was
  changed.
