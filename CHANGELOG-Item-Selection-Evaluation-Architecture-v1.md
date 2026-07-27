# Item Selection Evaluation Architecture v1

## 2026-07-27

- Approved a separate Item Selection application boundary after bounded
  read-only Domeggook Live Search.
- Defined the versioned hard-gate, `UNKNOWN`, coverage, profitability, verdict,
  ordering, persistence, API, UI, failure, security, and observability
  contracts.
- Preserved the existing Live Search endpoint and provider adapter as
  read-only with no evaluation or persistence side effect.
- Split implementation into ordered Stories and recorded database, admin auth,
  provider evidence, and Revenue threshold prerequisites.
- No runtime code, dependency, migration, environment, database, or Production
  behavior changed.
