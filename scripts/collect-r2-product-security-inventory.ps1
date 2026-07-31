param(
  [Parameter(Mandatory = $true)]
  [string]$TargetProjectRef,
  [switch]$ConfirmedNonProduction,
  [switch]$ConfirmedQuarantined
)

$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot

if (-not $ConfirmedNonProduction -or -not $ConfirmedQuarantined) {
  throw "R2 inventory requires explicit non-Production and quarantine confirmations."
}
$productionMarkers = @($env:VERCEL_ENV, $env:NODE_ENV, $env:SUPABASE_ENV) |
  Where-Object { $_ -and $_.ToLowerInvariant() -eq "production" }
if ($TargetProjectRef -match "(?i)(prod|production)" -or $productionMarkers) {
  throw "R2 inventory refuses Production markers."
}
if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
  throw "psql is required for read-only R2 inventory."
}

$databaseUrl = [Environment]::GetEnvironmentVariable("R2_REHEARSAL_DATABASE_URL")
if (-not $databaseUrl -or $databaseUrl -notmatch "^(?i:postgres(?:ql)?://)") {
  throw "Set R2_REHEARSAL_DATABASE_URL only in the approved secret store."
}
if (-not ($databaseUrl -match [regex]::Escape($TargetProjectRef))) {
  throw "The rehearsal database URL does not match the confirmed target project ref."
}

$sqlPath = Join-Path $repositoryRoot "supabase/rehearsal/r2_product_security_inventory.sql"
Write-Output "R2 target: $TargetProjectRef"
Write-Output "Inventory mode: read-only, sanitized catalog metadata"
& psql $databaseUrl --no-psqlrc --set ON_ERROR_STOP=1 --csv --file $sqlPath
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
