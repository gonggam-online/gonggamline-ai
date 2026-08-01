param(
  [string]$DatabaseContainer = "r2-rehearsal-db-0328e62",
  [string]$DatabaseName = "r2_rehearsal",
  [switch]$ConfirmedNonProduction,
  [switch]$ConfirmedQuarantined
)

$ErrorActionPreference = "Stop"

if (-not $ConfirmedNonProduction -or -not $ConfirmedQuarantined) {
  throw "R3 fingerprint collection requires explicit non-Production and quarantine confirmations."
}
if (@($env:VERCEL_ENV, $env:NODE_ENV, $env:SUPABASE_ENV) -contains "production") {
  throw "R3 fingerprint collection refuses Production environment markers."
}

$networkMode = docker inspect $DatabaseContainer --format "{{.HostConfig.NetworkMode}}"
$ports = docker inspect $DatabaseContainer --format "{{json .NetworkSettings.Ports}}"
$status = docker inspect $DatabaseContainer --format "{{.State.Status}}"
if ($networkMode -ne "none" -or $ports -ne "{}" -or $status -ne "running") {
  throw "R3 target must be running with network mode none and no published ports."
}

function Get-Sha256([string]$Value) {
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    return ([BitConverter]::ToString($sha.ComputeHash(
      [Text.Encoding]::UTF8.GetBytes($Value)))).Replace("-", "").ToLowerInvariant()
  } finally {
    $sha.Dispose()
  }
}

$catalog = docker exec --user postgres $DatabaseContainer pg_dump `
  --schema-only --no-owner --no-privileges --no-comments `
  --schema=public $DatabaseName
if ($LASTEXITCODE -ne 0) { throw "R3 catalog fingerprint failed." }

# PostgreSQL 17 emits a random psql safety token on every pg_dump invocation.
# Those transport-only lines are not catalog state and must not enter evidence.
$canonicalCatalog = @($catalog | Where-Object {
  $_ -notmatch '^\\(un)?restrict\s'
}) -join "`n"

$productRows = docker exec --user postgres $DatabaseContainer psql `
  -v ON_ERROR_STOP=1 -At -d $DatabaseName -c `
  "BEGIN READ ONLY; SELECT md5(row_to_json(p)::text) FROM public.products p ORDER BY md5(row_to_json(p)::text); ROLLBACK;"
if ($LASTEXITCODE -ne 0) { throw "R3 Product-row fingerprint failed." }
$canonicalProductRows = @($productRows | Where-Object {
  $_ -notin @("BEGIN", "ROLLBACK")
}) -join "`n"

$historyRelation = docker exec --user postgres $DatabaseContainer psql `
  -v ON_ERROR_STOP=1 -At -d $DatabaseName -c `
  "SELECT coalesce(to_regclass('supabase_migrations.schema_migrations')::text,'ABSENT');"
if ($LASTEXITCODE -ne 0) { throw "R3 history inspection failed." }

$history = @()
if ($historyRelation -eq "supabase_migrations.schema_migrations") {
  $history = @(docker exec --user postgres $DatabaseContainer psql `
    -v ON_ERROR_STOP=1 -At -d $DatabaseName -c `
    "BEGIN READ ONLY; SELECT version FROM supabase_migrations.schema_migrations ORDER BY version; ROLLBACK;" |
    Where-Object { $_ -notin @("BEGIN", "ROLLBACK") })
  if ($LASTEXITCODE -ne 0) { throw "R3 history version inspection failed." }
}

[ordered]@{
  schemaVersion = "gonggamline-r3-fingerprint-v1"
  catalogSha256 = Get-Sha256 $canonicalCatalog
  productRowsSha256 = Get-Sha256 $canonicalProductRows
  history = $history
} | ConvertTo-Json -Depth 3
