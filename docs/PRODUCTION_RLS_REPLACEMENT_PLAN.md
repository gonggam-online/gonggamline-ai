# Production RLS replacement plan

## Current anonymous exposure

Production evidence contains 59 permissive policies:

- three Product policies for `anon`: SELECT, INSERT, and UPDATE with
  unconditional predicates;
- six Commerce OS policies for `anon, authenticated`: unconditional ALL;
- 50 migration 005–020 policies for `{public}`: unconditional ALL.

`public` includes anonymous and authenticated roles. The deployed policy set
therefore permits broad reads and writes wherever RLS is enabled. Historical
fidelity does not make this an acceptable Production authorization model.

## Current application dependency

The application creates only one Supabase client from the public URL and anon
key. Browser components call application API routes, but those server routes
still access PostgREST as `anon`. Active services require SELECT, INSERT,
UPDATE, and UPSERT across Product, Market, Workflow, Supplier, Procurement,
Listing, Coupang, Company OS, Revenue, and Runtime tables. No active DELETE
dependency was found.

Removing the current policies before replacing the calling identity would
cause widespread application failures.

## Required permissions by principal

| Principal | Immediate requirement | Prohibited default |
|---|---|---|
| Anonymous browser | Public health and explicitly public read DTOs only | Direct table writes and unrestricted table reads |
| Server application | Verified per-route SELECT/INSERT/UPDATE/UPSERT | Blanket ALL and DELETE |
| Runtime workers | Queue lease/update/event operations scoped to worker flow | General access to unrelated business tables |
| Owner/operator | Authenticated administrative operations with auditability | Shared anon identity |
| Marketplace adapters | Narrow approved operations after human gates | General schema access |

## Service-role access

No service-role client exists in the repository. A service-role key must never
be exposed through `NEXT_PUBLIC_*`, browser bundles, logs, or client responses.
If adopted, it belongs in a server-only infrastructure adapter with explicit
route authorization, secret management, audit logging, negative tests, and
least-privilege service boundaries. Service-role bypass is not itself an
authorization design.

## Owner access

The owner/operator needs an authenticated identity and explicit administrative
authorization. Owner access should be separate from anonymous API use and
record actor, action, target, result, and approval context for high-risk
commerce operations.

## Future multi-tenant access

No verified tenant or ownership columns exist across the current schema.
Tenant policies cannot be invented. A future design must first define tenant,
membership, ownership, sharing, worker delegation, and backfill semantics,
then add tested ownership keys before tenant-filtered policies.

## Recommended Production policy sequence

1. Inventory every route/service operation and choose its authenticated
   principal.
2. Introduce server-only access without changing public API contracts.
3. Add negative authorization tests and audit evidence.
4. In Preview/Staging, replace unconditional policies table-by-table with
   operation-specific policies.
5. Deny DELETE by default; retain only proven operations.
6. Verify schema cache, application routes, workers, and failure behavior.
7. Roll out to Production with an owner-approved rollback window.

The immediate MVP target is authenticated/server-mediated access with no
anonymous writes and only explicitly public anonymous reads. The long-term
target is tenant/owner-scoped policies and isolated worker privileges.

## Historical preservation and rollback

`003_dev_rls.sql` remains unchanged as historical evidence and must never be
executed as the Production replacement. The future RLS migration must capture
the current policy definitions, use explicit policy names/roles/commands, and
define a reversible policy-only rollback. Rollback must not silently restore
unconditional anonymous full CRUD without a separately approved emergency
decision.
