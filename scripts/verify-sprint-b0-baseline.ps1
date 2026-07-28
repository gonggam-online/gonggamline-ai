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

if ($productionMarkers -contains "production") {
  throw "Sprint B-0 replay refuses Production environment markers."
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker is required for the disposable Supabase replay. Production or linked databases are not permitted."
}

$cli = @("npx.cmd", "--yes", "supabase@2.110.0")

if ($Stop) {
  & $cli[0] $cli[1] $cli[2] "stop" "--no-backup"
  exit $LASTEXITCODE
}

if ($Start) {
  & $cli[0] $cli[1] $cli[2] "start"
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}

& $cli[0] $cli[1] $cli[2] "db" "reset" "--local"
exit $LASTEXITCODE
