# R2 Product Security Architecture

## 2026-07-31

- Re-audited R1 Product mutation compatibility at the merged Stage 01 base.
- Defined intentional anonymous Product read with no anonymous or authenticated write authority.
- Defined explicit RLS, table/RPC grant, sequence, and owner-scoped default privilege outcomes.
- Designed a forward-only candidate migration gated by restored-state inventory.
- Defined a quarantined restore-based non-Production rehearsal with negative role, R1 atomicity, default-privilege, exact-head CI, and Preview gates.

No SQL, restore, Supabase configuration, Production action, or commerce write is authorized.
