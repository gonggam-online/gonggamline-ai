param(
  [string]$Profile = "gonggamline-admin",
  [string]$Region = "ap-southeast-1",
  [string]$StackName = "gonggamline-independent-backup-v1",
  [string]$ChangeSetName = "base-boundary-review-v1",
  [string]$AwsExe = "C:\Program Files\Amazon\AWSCLIV2\aws.exe",
  [switch]$RecreateExistingStack
)

$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$TemplatePath = Join-Path $RepoRoot "infra\aws-backup\cloudformation.json"
$TemplateUriPath = $TemplatePath -replace '\\', '/'
$ConfigPath = Join-Path $RepoRoot ".aws\config"
$CredPath = Join-Path $RepoRoot ".aws\credentials"

if (-not (Test-Path $ConfigPath)) {
  throw "Missing repo AWS config file: $ConfigPath"
}
if (-not (Test-Path $TemplatePath)) {
  throw "Missing template: $TemplatePath"
}
if (-not (Test-Path $AwsExe)) {
  throw "AWS CLI not found: $AwsExe"
}

$env:AWS_CONFIG_FILE = $ConfigPath
$env:AWS_SHARED_CREDENTIALS_FILE = $CredPath
$env:AWS_SDK_LOAD_CONFIG = "1"

function Invoke-Aws {
  param([string[]]$AwsArgs, [switch]$RawJson)

  $oldPref = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    Write-Host ("   AWS: $($AwsExe) $($AwsArgs -join ' ')")
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $AwsExe
    $psi.Arguments = ($AwsArgs | ForEach-Object { '"' + ($_ -replace '"', '""') + '"' }) -join ' '
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $proc = [System.Diagnostics.Process]::Start($psi)
    $stdout = $proc.StandardOutput.ReadToEnd()
    $stderr = $proc.StandardError.ReadToEnd()
    $proc.WaitForExit()
  }
  finally {
    $ErrorActionPreference = $oldPref
  }

  if ($proc.ExitCode -ne 0) {
    $msg = @()
    if (-not [string]::IsNullOrWhiteSpace($stdout)) { $msg += $stdout.Trim() }
    if (-not [string]::IsNullOrWhiteSpace($stderr)) { $msg += $stderr.Trim() }
    throw ("AWS CLI failed ({0}): {1}" -f $proc.ExitCode, ($msg -join "`n"))
  }

  $raw = if ([string]::IsNullOrWhiteSpace($stdout)) { "" } else { $stdout.Trim() }
  if ($RawJson) {
    if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
    return $raw | ConvertFrom-Json
  }
  return $raw
}

function Invoke-AwsInteractive {
  param([string[]]$AwsArgs)

  $oldPref = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    Write-Host ("   AWS interactive: $($AwsExe) $($AwsArgs -join ' ')")
    & $AwsExe @AwsArgs
    $exitCode = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $oldPref
  }

  if ($exitCode -ne 0) {
    throw "AWS interactive command failed ($exitCode): $($AwsArgs -join ' ')"
  }
}

function Try-GetStackStatus {
  param([string]$StackName, [string]$Region, [string]$Profile)
  try {
    $json = Invoke-Aws -AwsArgs @("cloudformation", "describe-stacks", "--stack-name", $StackName, "--region", $Region, "--profile", $Profile, "--output", "json", "--query", "Stacks[0].StackStatus") -RawJson
    return ($json | Out-String).Trim()
  } catch {
    return $null
  }
}

function Poll-Until {
  param(
    [string]$Label,
    [scriptblock]$Checker,
    [int]$MaxSeconds = 900,
    [int]$IntervalSeconds = 10
  )

  $start = Get-Date
  while ($true) {
    $value = & $Checker
    $valueText = if ($null -eq $value) { "<null>" } else { if ($value -is [System.Array]) { ($value -join ",") } else { [string]$value } }
    Write-Host ("[{0}s] {1}: {2}" -f [int](([DateTime]::Now - $start).TotalSeconds), $Label, $valueText)
    if ($value) { return $value }
    if (([DateTime]::Now - $start).TotalSeconds -ge $MaxSeconds) { throw "Timeout waiting for $Label" }
    Start-Sleep -Seconds $IntervalSeconds
  }
}

function Clear-SsoCache {
  param([string]$RepoRoot)

  $repoCache = Join-Path $RepoRoot ".aws\sso\cache"
  if (Test-Path $repoCache) {
    Get-ChildItem $repoCache -File -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
  }
}

Write-Host "1) AWS profile check"
Invoke-Aws -AwsArgs @("configure", "list-profiles", "--output", "text")

Write-Host "2) Re-authenticate SSO"
Write-Host "   Logging out existing SSO session (if any)..."
& $AwsExe sso logout --profile $Profile
Clear-SsoCache -RepoRoot $RepoRoot
Write-Host "   Starting SSO interactive login..."
try {
  Invoke-AwsInteractive -AwsArgs @("sso", "login", "--profile", $Profile, "--region", $Region)
}
catch {
  Write-Host "   Interactive SSO login failed. Falling back to device-code flow..."
  Write-Host $_
  Invoke-AwsInteractive -AwsArgs @("sso", "login", "--profile", $Profile, "--region", $Region, "--use-device-code")
}
$identity = Invoke-Aws -AwsArgs @("sts", "get-caller-identity", "--profile", $Profile, "--region", $Region, "--output", "json") -RawJson
Write-Host ("   Account: {0}" -f $identity.Account)
Write-Host ("   Arn: {0}" -f $identity.Arn)

Write-Host "3) Ensure stack is clean"
$current = Try-GetStackStatus -StackName $StackName -Region $Region -Profile $Profile
if ($current -and $current -notmatch "DELETE_COMPLETE|NOT_EXISTS") {
  Write-Host "   Existing status: $current"
  if (-not $RecreateExistingStack) {
    throw "Existing stack will not be deleted automatically. Verify it with scripts/verify-aws-backup-base-boundary.ps1. Use -RecreateExistingStack only after separate destructive approval."
  }
  Invoke-Aws -AwsArgs @("cloudformation", "delete-stack", "--profile", $Profile, "--region", $Region, "--stack-name", $StackName) | Out-Null
  Poll-Until "stack delete" {
    $s = Try-GetStackStatus -StackName $StackName -Region $Region -Profile $Profile
    if (-not $s) { return "DELETE_COMPLETE" }
    if ($s -eq "DELETE_COMPLETE") { return $s }
    return $null
  }
}

Write-Host "4) Remove old ChangeSet if exists"
try {
  Invoke-Aws -AwsArgs @("cloudformation", "delete-change-set", "--profile", $Profile, "--region", $Region, "--stack-name", $StackName, "--change-set-name", $ChangeSetName) | Out-Null
} catch {
  Write-Host "   (no old ChangeSet to delete)"
}

Write-Host "5) Create CREATE change set (disabled worker boundary)"
Invoke-Aws -AwsArgs @(
  "cloudformation", "create-change-set",
  "--profile", $Profile,
  "--region", $Region,
  "--stack-name", $StackName,
  "--change-set-name", $ChangeSetName,
  "--change-set-type", "CREATE",
  "--template-body", "file://$TemplateUriPath",
  "--parameters", "ParameterKey=EnableWorkerResources,ParameterValue=false",
  "--parameters", "ParameterKey=BackupWorkerImageUri,ParameterValue=",
  "--parameters", "ParameterKey=ProductionDatabaseSecretArn,ParameterValue=",
  "--capabilities", "CAPABILITY_NAMED_IAM",
  "--description", "GonggamLine Singapore independent backup base boundary; worker omitted; execute-only"
) | Out-Null

Write-Host "6) Wait change set CREATE_COMPLETE"
Poll-Until "create-change-set" {
  $cs = Invoke-Aws -AwsArgs @(
    "cloudformation", "describe-change-set",
    "--profile", $Profile,
    "--region", $Region,
    "--stack-name", $StackName,
    "--change-set-name", $ChangeSetName,
    "--output", "json"
  ) -RawJson
  if ($cs.Status -eq "CREATE_COMPLETE" -and $cs.ExecutionStatus -eq "AVAILABLE") { return $cs.Status }
  return $null
}

Write-Host "7) Execute change set"
Invoke-Aws -AwsArgs @("cloudformation", "execute-change-set", "--profile", $Profile, "--region", $Region, "--stack-name", $StackName, "--change-set-name", $ChangeSetName) | Out-Null

Write-Host "8) Wait stack-create-complete"
Invoke-Aws -AwsArgs @("cloudformation", "wait", "stack-create-complete", "--profile", $Profile, "--region", $Region, "--stack-name", $StackName) | Out-Null

Write-Host "9) Verify base resources"
$resources = Invoke-Aws -AwsArgs @("cloudformation", "describe-stack-resources", "--profile", $Profile, "--region", $Region, "--stack-name", $StackName, "--output", "json") -RawJson
$actual = @($resources.StackResourceSummaries | ForEach-Object { $_.LogicalResourceId })
$required = @("BackupBucket", "BackupBucketPolicy", "BackupDeadLetterQueue", "BackupImageRepository", "BackupKey", "BackupKeyAlias")
$missing = @($required | Where-Object { $actual -notcontains $_ })
if ($missing.Count -gt 0) {
  throw "Missing expected resources after execute: $($missing -join ', ')"
}
Write-Host ("   OK. Resource count: {0}" -f $actual.Count)

Write-Host "DONE"
