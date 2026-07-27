# Supabase deployed object classification

## Evidence identity

The authoritative Production evidence is the thirteen operator CSV files under
`docs/inspection-results/`, captured as database user `postgres` from PostgreSQL
17.6 at `2026-07-27 08:18:39.50263+00`.

| Evidence group | Observed count | Classification scope |
|---|---:|---|
| Public tables | 57 | All expected Product, Commerce OS, and Git-chain tables are present |
| Public columns | 883 | Column definitions are available |
| Constraints | 268 | Constraint definitions are available |
| Indexes | 148 | Index definitions are available |
| Policies | 59 | Policy roles, commands, qualifiers, and checks are available |
| Git-chain RLS states | 51/51 enabled | Product plus all 50 Git-created tables |
| Commerce OS triggers | 4 | All four recovered trigger names and definitions |
| Extensions | 5 | Includes required `pgcrypto` |

CSV SHA-256 values:

| File | SHA-256 |
|---|---|
| Supabase Snippet 01.csv | `17bfda5799a2678a92f82abc2a6b2350590041fd673237502968cbb63218b66a` |
| Supabase Snippet 02.csv | `64220fbbac36146baaacb8cabb8c30c6c02775e98308af543596baa26d867550` |
| Supabase Snippet 03.csv | `1c29d0f9dd674448caa153e1982086ac7142b02956a2517e61027eea8660a9c9` |
| Supabase Snippet 04.csv | `7cfcc1c47ed38fc11ae5bf45cf4f1f3acf0cb39fc880a6a2e0e73314ae73af70` |
| Supabase Snippet 05.csv | `5b10ade116635dbddbf5bc13adecb5c5b5437ee26ae31a832b4bc898a2cfa8ab` |
| Supabase Snippet 06.csv | `9ff0d217a890eaa8eceed6c32ac2f1e84eaa6d17f1836ed03b3ae993f5c0db87` |
| Supabase Snippet 07.csv | `299bce29912bfe738cfed29f656f99d427a762fd2a3cf7f3b2210c329befffe0` |
| Supabase Snippet 08.csv | `5820d0ae8d39018f721372e6a3d193cb24e3afcd0ec878db0879ccd643c1b989` |
| Supabase Snippet 09.csv | `6ceb3323ed95be8ba66c7636ac541f83b80d5b0b6abb27ab3779a24df7df55ee` |
| Supabase Snippet 10.csv | `e91b16f44c74115754725f1fcec010fe5a20f7719dc9d277120d4354527e8408` |
| Supabase Snippet 11.csv | `8e9c4688dfe0034dc8963a7d849ffe95419afa00093fc3ed1e1cbf45dca4ceff` |
| Supabase Snippet 12.csv | `d5ed3b69053eb9d75352157ecf15b05ee92f299a6feba5987e7a33b08d099724` |
| Supabase Snippet 13.csv | `446d56b61d948d6d863f0ae96bfbe57b6df676a5d31f23949cf96514cd8d771b` |

## Baseline classifications

| Source/object group | Classification | Production evidence and rationale |
|---|---|---|
| Products table, 25 baseline columns, identity PK, unique `product_no`, defaults and nullability | EXACT | Column, constraint, and fingerprint outputs match the verbatim baseline |
| Product workflow 10 columns, 3 checks, 4 indexes | EXACT | Every named property and definition is present |
| Product RLS enabled | EXACT | Git-chain object output reports `rls_enabled=true` |
| Three Product policies | EXACT historically; INCOMPATIBLE for Production security | Names and anon semantics match source; anonymous insert/update is not least privilege |
| Six Commerce OS tables and columns | EXACT | All six tables and their recovered columns are present |
| Commerce OS internal FKs/checks and conditional `commerce_projects_provider_fk` | EXACT | All named definitions are present |
| Seven Commerce OS indexes | EXACT | All recovered names and definitions are present |
| `set_updated_at()` function | UNKNOWN | CSV 06 contains only its final trigger result grid; function definition was not exported |
| Four Commerce OS updated-at triggers | EXACT | All four names are enabled and definitions match |
| Commerce OS RLS-enabled state | UNKNOWN | CSV 11 proves policies, but the Commerce OS RLS-state result grid was not exported |
| Six historical Commerce OS policies | EXACT historically; INCOMPATIBLE for Production security | They match `003_dev_rls` and grant unconditional ALL to anon/authenticated |

## Existing Git chain classifications

The 50 tables created by migrations 005–020, Product alterations in 003–004,
their expected columns/constraints/indexes, and required `pgcrypto` extension
are present in the catalog evidence. CSV 12 proves RLS is enabled for Product
and all 50 Git-created tables.

| Engine/source | Tables | Schema result | Security result |
|---|---:|---|---|
| Competition Analysis, 003–004 | Product alterations | EXACT | Product policies INCOMPATIBLE for Production |
| Market Engine, 005–009 | 18 | EXACT | 18 permissive policies INCOMPATIBLE |
| Supplier Engine, 010 | 3 | EXACT | 3 permissive policies INCOMPATIBLE |
| Workflow/Procurement/Listing/Coupang, 011–014 | 13 | EXACT | 13 permissive policies INCOMPATIBLE |
| AI Decision and Company OS, 015–018 | 12 | EXACT | 12 permissive policies INCOMPATIBLE |
| Revenue and Runtime, 019–020 | 4 | EXACT | 4 permissive policies INCOMPATIBLE |
| `pgcrypto` extension | 1 | EXACT | Not applicable |

All 50 Git policies resolve to role array `{public}`, command `ALL`, qualifier
`true`, and check `true`. This matches their historical SQL but is incompatible
with Production least privilege.

## Migration metadata classification

| Object | Classification | Evidence |
|---|---|---|
| `supabase_migrations.schema_migrations` | ABSENT within inspected catalog visibility | Candidate-column output contains no `supabase_migrations` rows |
| `auth.schema_migrations` | COMPATIBLE with Auth subsystem only | One `version` column; not evidence of application migration history |
| `realtime.schema_migrations` | COMPATIBLE with Realtime subsystem only | `version` and `inserted_at`; not application history |
| `storage.migrations` | COMPATIBLE with Storage subsystem only | Storage-owned metadata; not application history |
| Repository migration runner/metadata format | UNKNOWN | No authoritative runner or application history relation was identified |
| Historical execution timestamps/order | UNKNOWN | SQL Editor timestamps remain unavailable |

## Row-count evidence

CSV 09 contains catalog estimates only. `products` reports approximately 151
rows; most newly created or unanalyzed tables report `-1`. This proves neither
emptiness nor safe replay and must not be used for destructive decisions.

## Classification blockers

The classification is complete in that every expected object/property is
assigned a state. Migration generation is not ready because the following
required properties remain `UNKNOWN`:

1. The deployed `public.set_updated_at()` function body and attributes.
2. RLS-enabled state for the six recovered Commerce OS tables.
3. The application migration runner and its metadata/version format.
4. Exact SQL Editor execution chronology and revision history.
5. Preview/Staging equivalence to Production.
