# Supabase restoration decision matrix

All deployed rows are preliminary `UNKNOWN` until operator output is supplied.

| Classification | Fresh replay treatment | Existing Production treatment | History treatment | Gate |
|---|---|---|---|---|
| EXACT | Retain canonical source in proposed order | Do not rerun baseline DDL | Reconcile only after runner/format proof | Catalog evidence and review |
| COMPATIBLE | Document intentional representation | Preserve unless a deliberate normalization is approved | Separate from schema decision | Behavioral proof |
| INCOMPATIBLE | Choose canonical design before replay | Purpose-built corrective migration; no blind baseline replay | Never hide schema drift with history rows | Owner-approved high-risk design |
| ABSENT | Include authorized additive source | Purpose-built additive migration | Record only after actual application by identified runner | Dependency and rollback review |
| UNKNOWN | Block | Block | Block | Complete, labeled evidence |

## Security override

Historical `003_dev_rls` is evidence only. Its anonymous and authenticated
unconditional full access is never an acceptable Production outcome,
regardless of historical fidelity. A separately reviewed least-privilege policy
must be designed from verified access paths and ownership semantics.

## History boundary

Schema repair and migration-history reconciliation are separate operations.
No direct metadata-row insertion is proposed. First identify the migration
runner, candidate relation, primary/version format, checksum/name behavior, and
official repair mechanism.
