param(
  [switch]$Start,
  [switch]$Stop
)

$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repositoryRoot

$productionMarkers = @(
  $env:VERCEL_ENV,
  $env:NODE_ENV,
  $env:SUPABASE_ENV
) | Where-Object { $_ }

if ($productionMarkers | Where-Object { $_.ToLowerInvariant() -eq "production" }) {
  throw "Item Selection verification refuses Production environment markers."
}

foreach ($name in @("SUPABASE_DB_URL", "DATABASE_URL", "POSTGRES_URL")) {
  $value = [Environment]::GetEnvironmentVariable($name)
  if ($value -and $value -match "^(?i:postgres(?:ql)?://)") {
    throw "Item Selection verification refuses remote database URLs."
  }
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker is required for the disposable Item Selection replay."
}
if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
  throw "Supabase CLI 2.110.0 is required and must be installed before verification."
}

$actualVersion = (& supabase --version).Trim()
if ($LASTEXITCODE -ne 0 -or $actualVersion -ne "2.110.0") {
  throw "Supabase CLI 2.110.0 is required; found '$actualVersion'."
}

$startedHere = $false
try {
  if ($Start) {
    & supabase start
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    $startedHere = $true
  }

  & supabase db reset --local
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  $npmCommand = if (Get-Command npm.cmd -ErrorAction SilentlyContinue) {
    "npm.cmd"
  } else {
    "npm"
  }
  & $npmCommand test -- --test-name-pattern "A0|A1|Auth routes|baseline manifest|migration inventory|replay runner"
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  $databaseContainer = "supabase_db_gonggamline-ai-sprint-b0"
  $catalogSql = @'
DO $verify$
DECLARE
  actual_tables text[];
  actual_type_count integer;
  actual_function_count integer;
  insecure_count integer;
BEGIN
  SELECT array_agg(c.relname ORDER BY c.relname)
    INTO actual_tables
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relkind = 'r'
     AND c.relname IN (
       'item_selection_evaluations',
       'item_selection_runs',
       'security_audit_events'
     );
  IF actual_tables IS DISTINCT FROM ARRAY[
    'item_selection_evaluations',
    'item_selection_runs',
    'security_audit_events'
  ]::text[] THEN
    RAISE EXCEPTION 'A11 table fingerprint mismatch: %', actual_tables;
  END IF;

  SELECT count(*) INTO actual_type_count
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
   WHERE n.nspname = 'public'
     AND t.typname = 'item_selection_evaluation_write_v1';
  IF actual_type_count <> 1 THEN
    RAISE EXCEPTION 'A11 composite type fingerprint mismatch';
  END IF;

  SELECT count(*) INTO actual_function_count
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN (
       'create_item_selection_run_v1',
       'finalize_item_selection_run_v1'
     )
     AND p.prosecdef
     AND p.proconfig @> ARRAY['search_path=pg_catalog, public']::text[];
  IF actual_function_count <> 2 THEN
    RAISE EXCEPTION 'A11 function fingerprint mismatch';
  END IF;

  SELECT count(*) INTO insecure_count
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname IN (
       'item_selection_evaluations',
       'item_selection_runs',
       'security_audit_events'
     )
     AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity);
  IF insecure_count <> 0 THEN
    RAISE EXCEPTION 'A06 RLS fingerprint mismatch';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname IN (
         'item_selection_evaluations',
         'item_selection_runs',
         'security_audit_events'
       )
       AND (
         has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
         OR has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
       )
  ) THEN
    RAISE EXCEPTION 'A06 direct table privilege found';
  END IF;
END
$verify$;
'@
  $catalogSql | docker exec -i $databaseContainer psql -v ON_ERROR_STOP=1 -U postgres -d postgres
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  Write-Output "A01-A12 security evidence: PASS"
  Write-Output "Disposable migrations 000-021 replay: PASS"
  Write-Output "Item Selection catalog fingerprint: PASS"
}
finally {
  if ($Stop -or $startedHere) {
    & supabase stop --no-backup
  }
}
