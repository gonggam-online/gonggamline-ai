# Sprint A final risk register

Sprint A closes the evidence and design work. It does not authorize database or
security execution.

| Risk | Impact | Likelihood | Mitigation | Owner | Can Sprint B proceed? |
|---|---|---|---|---|---|
| 59 permissive Production policies permit broad access | Critical data/security exposure | High while policies remain | Execute the approved identity-first RLS replacement in a separate high-risk Story | Database/security owner | Yes, if Sprint B remains read-only and adds no direct database writes |
| Server routes use the public anon client | Removing policies prematurely would break business APIs | High | Introduce a server-only/authenticated principal before restricting policies; add negative authorization tests | Application and security owners | Yes; do not couple the read-only vertical slice to RLS execution |
| Deployed `set_updated_at()` body was not exported | A future function replacement could change timestamp behavior | Low unless function is changed | Use recovered body only for fresh replay; inspect deployed body before any Production function change | Database owner | Yes |
| Commerce OS RLS enabled/forced state grid was not exported | Historical enforcement state cannot be proven | Medium security significance | Future RLS migration explicitly enables and verifies desired state; catalog check is an execution precondition | Database/security owner | Yes |
| No application migration-history relation is visible | Repository and Production history are not automatically synchronized | Medium | Adopt only the official Supabase migration workflow; use supported repair/baseline operation or documented forward-only boundary | Database/DevOps owner | Yes |
| Historical SQL Editor timestamps are unavailable | Original execution chronology cannot be claimed | Low | Canonical dependency order is the new repository truth; do not claim historical timestamps | Database owner | Yes |
| Preview/Staging parity is not collected | Production changes cannot be rehearsed safely yet | High for future execution, none for documentation | Require full inspection and replay/RLS tests in Preview/Staging before Production execution | DevOps/database owner | Yes |
| Production identity/tenant ownership model is not implemented | Least-privilege policies cannot yet be executed | High | Keep RLS execution separate; approve immediate server identity and later tenant model | Product/security owner | Yes |
| Dependency audit reports 12 high-severity transitive advisories | Toolchain/build exposure | Medium | Address in a separate dependency-upgrade Story with breaking-change validation | Engineering owner | Yes |
| PRs #28–#30 are stacked until predecessors merge | Review diff may include predecessor work | Medium | Merge/refresh in order and never force-push; revalidate exact heads | Delivery owner | Yes |

## Close-out judgment

Every residual item has an owner, mitigation, and future verification boundary.
None requires inventing evidence or modifying Production to close the
documentation/reconciliation sprint. Sprint B may proceed because its proposed
Domeggook Live Search slice is read-only and independent of deferred database
execution.
