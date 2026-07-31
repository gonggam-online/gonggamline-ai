param(
  [switch]$Start,
  [switch]$Stop
)

$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repositoryRoot

$productionMarkers = @($env:VERCEL_ENV, $env:NODE_ENV, $env:SUPABASE_ENV) |
  Where-Object { $_ }
if ($productionMarkers | Where-Object { $_.ToLowerInvariant() -eq "production" }) {
  throw "R1 verification refuses Production environment markers."
}
foreach ($name in @("SUPABASE_DB_URL", "DATABASE_URL", "POSTGRES_URL")) {
  $value = [Environment]::GetEnvironmentVariable($name)
  if ($value -and $value -match "^(?i:postgres(?:ql)?://)") {
    throw "R1 verification refuses remote database URLs."
  }
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker is required for disposable R1 verification."
}
if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
  throw "Supabase CLI 2.110.0 is required for R1 verification."
}
if ((& supabase --version).Trim() -ne "2.110.0") {
  throw "Supabase CLI 2.110.0 is required for R1 verification."
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

  $sqlPath = Join-Path $repositoryRoot "tests/sql/r1-atomic-product-mutation.sql"
  Get-Content -Raw -LiteralPath $sqlPath |
    docker exec -i supabase_db_gonggamline-ai-sprint-b0 `
      psql -v ON_ERROR_STOP=1 -U postgres -d postgres
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
finally {
  if ($Stop -or $startedHere) {
    & supabase stop --no-backup
  }
}
