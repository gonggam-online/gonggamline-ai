param(
  [Parameter(Mandatory = $true)][string]$ApprovedPlanSha256,
  [string]$DatabaseContainer = "r2-rehearsal-db-0328e62",
  [string]$ImageTag = "gonggamline/r3-supabase-cli:2.110.0",
  [switch]$ExecuteRepair
)

$ErrorActionPreference = "Stop"
$expectedPlan = "fc37b1402c76fce8b807b925b8d74d81e66b8665e39f38bbced912d6ee85b34c"
$versions = 0..22 | ForEach-Object { $_.ToString("000") }

if (-not $ExecuteRepair) { throw "R3 repair is fail-closed. Pass -ExecuteRepair only after exact owner approval." }
if ($ApprovedPlanSha256 -ne $expectedPlan) { throw "Approved repair plan fingerprint mismatch." }
if (@($env:VERCEL_ENV, $env:NODE_ENV, $env:SUPABASE_ENV) -contains "production") {
  throw "R3 sidecar refuses Production environment markers."
}

$networkMode = docker inspect $DatabaseContainer --format "{{.HostConfig.NetworkMode}}"
$ports = docker inspect $DatabaseContainer --format "{{json .NetworkSettings.Ports}}"
$status = docker inspect $DatabaseContainer --format "{{.State.Status}}"
if ($networkMode -ne "none" -or $ports -ne "{}" -or $status -ne "running") {
  throw "R3 target must be running with network mode none and no published ports."
}

$password = Read-Host "Enter isolated rehearsal postgres password" -AsSecureString
$credentialRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("r3-pgpass-" + [guid]::NewGuid().ToString("N"))
try {
  New-Item -ItemType Directory -Path $credentialRoot | Out-Null
  $acl = Get-Acl -LiteralPath $credentialRoot
  $acl.SetAccessRuleProtection($true, $false)
  $rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
    [System.Security.Principal.WindowsIdentity]::GetCurrent().Name, "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow")
  $acl.SetAccessRule($rule)
  Set-Acl -LiteralPath $credentialRoot -AclObject $acl
  $plainPassword = [System.Net.NetworkCredential]::new("", $password).Password
  "127.0.0.1:5432:r2_rehearsal:postgres:$plainPassword" | Set-Content -LiteralPath (Join-Path $credentialRoot "pgpass") -Encoding ascii -NoNewline
  $plainPassword = $null

  docker run --rm --network "container:$DatabaseContainer" --read-only --cap-drop ALL `
    --security-opt no-new-privileges --user 65532:65532 `
    --tmpfs "/run/secure:rw,noexec,nosuid,size=65536" `
    --tmpfs "/home/r3cli:rw,noexec,nosuid,size=65536" `
    --mount "type=bind,source=$credentialRoot,target=/run/secrets,readonly" `
    --mount "type=bind,source=$PWD,target=/work,readonly" --workdir /work `
    --env R3_PGPASS_SOURCE=/run/secrets/pgpass --env R3_TARGET_CLASS=owner-approved-isolated-restore `
    $ImageTag migration repair @versions --status applied
  if ($LASTEXITCODE -ne 0) { throw "R3 official CLI repair failed." }
} finally {
  if (Test-Path -LiteralPath $credentialRoot) {
    Remove-Item -LiteralPath $credentialRoot -Recurse -Force
  }
}
