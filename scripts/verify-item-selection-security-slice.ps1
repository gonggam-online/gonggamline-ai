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

  $localStatus = @(& supabase status -o env)
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  $apiLine = $localStatus | Where-Object { $_ -match '^API_URL=' } | Select-Object -First 1
  $serviceRoleLine = $localStatus | Where-Object { $_ -match '^SERVICE_ROLE_KEY=' } | Select-Object -First 1
  if (-not $apiLine -or -not $serviceRoleLine) {
    throw "Local Supabase status did not return the RPC verification configuration."
  }
  $env:REPRO_SUPABASE_URL = ($apiLine -replace '^API_URL="?', '' -replace '"$', '')
  $env:REPRO_SUPABASE_SERVICE_ROLE_KEY =
    ($serviceRoleLine -replace '^SERVICE_ROLE_KEY="?', '' -replace '"$', '')
  $rpcExitCode = 0
  try {
    & $npmCommand exec -- tsx scripts/verify-item-selection-finalization-rpc.ts
    $rpcExitCode = $LASTEXITCODE
  }
  finally {
    Remove-Item Env:REPRO_SUPABASE_URL, Env:REPRO_SUPABASE_SERVICE_ROLE_KEY `
      -ErrorAction SilentlyContinue
  }
  if ($rpcExitCode -ne 0) { exit $rpcExitCode }

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
       'finalize_item_selection_run_v1',
       'reconcile_stale_item_selection_run_v1'
     )
     AND p.prosecdef
     AND p.proconfig @> ARRAY['search_path=pg_catalog, public']::text[];
  IF actual_function_count <> 3 THEN
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

  $staleRecoverySql = @'
DO $verify$
DECLARE
  principal constant text := '11111111-1111-4111-8111-111111111111';
  stale_run public.item_selection_runs;
  replayed_run public.item_selection_runs;
  recent_run_id uuid;
BEGIN
  INSERT INTO public.item_selection_runs (
    provider, keyword, requested_size, ruleset_version, evaluator_version,
    profitability_policy_version, profitability_calculation_contract_version,
    request_fingerprint, idempotency_key_hash, requested_by_principal_id,
    started_at
  ) VALUES (
    'domeggook', 'stale-fixture', 10, 'rules-v1', 'evaluator-v1',
    'profit-v1', 'gonggamline-profitability-calculation-v1',
    repeat('a', 64), repeat('b', 64), principal,
    statement_timestamp() - interval '31 minutes'
  ) RETURNING * INTO stale_run;

  SELECT * INTO stale_run
  FROM public.reconcile_stale_item_selection_run_v1(
    stale_run.id, repeat('a', 64), principal,
    '/internal/item-selection/reconcile-stale',
    '22222222-2222-4222-8222-222222222222'
  );
  IF stale_run.status <> 'FAILED'
    OR stale_run.failure_code <> 'STALE_RUN_RECOVERED'
    OR stale_run.persisted_evaluation_count <> 0 THEN
    RAISE EXCEPTION 'stale recovery state mismatch';
  END IF;

  SELECT * INTO replayed_run
  FROM public.reconcile_stale_item_selection_run_v1(
    stale_run.id, repeat('a', 64), principal,
    '/internal/item-selection/reconcile-stale',
    '33333333-3333-4333-8333-333333333333'
  );
  IF replayed_run IS DISTINCT FROM stale_run THEN
    RAISE EXCEPTION 'stale recovery replay mismatch';
  END IF;
  IF (SELECT count(*) FROM public.security_audit_events
      WHERE event_code = 'ITEM_SELECTION_RECONCILE_STALE'
        AND administrator_user_id = principal::uuid) <> 1 THEN
    RAISE EXCEPTION 'stale recovery audit mismatch';
  END IF;

  INSERT INTO public.item_selection_runs (
    provider, keyword, requested_size, ruleset_version, evaluator_version,
    profitability_policy_version, profitability_calculation_contract_version,
    request_fingerprint, idempotency_key_hash, requested_by_principal_id
  ) VALUES (
    'domeggook', 'recent-fixture', 10, 'rules-v1', 'evaluator-v1',
    'profit-v1', 'gonggamline-profitability-calculation-v1',
    repeat('c', 64), repeat('d', 64), principal
  ) RETURNING id INTO recent_run_id;

  BEGIN
    PERFORM public.reconcile_stale_item_selection_run_v1(
      recent_run_id, repeat('c', 64), principal,
      '/internal/item-selection/reconcile-stale',
      '44444444-4444-4444-8444-444444444444'
    );
    RAISE EXCEPTION 'recent recovery unexpectedly succeeded';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
  IF (SELECT status FROM public.item_selection_runs WHERE id = recent_run_id) <> 'RUNNING' THEN
    RAISE EXCEPTION 'recent recovery changed the run';
  END IF;
END
$verify$;
'@
  $staleRecoverySql | docker exec -i $databaseContainer psql -v ON_ERROR_STOP=1 -U postgres -d postgres
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  Write-Output "A01-A12 security evidence: PASS"
  Write-Output "Disposable migrations 000-025 replay: PASS"
  Write-Output "Item Selection catalog fingerprint: PASS"
  Write-Output "Item Selection finalization RPC behavior: PASS"
  Write-Output "Item Selection stale recovery behavior: PASS"
}
finally {
  if ($Stop -or $startedHere) {
    & supabase stop --no-backup
  }
}
