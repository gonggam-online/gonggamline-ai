param(
    [string]$AWS_EXE = "C:\Program Files\Amazon\AWSCLIV2\aws.exe",
    [string]$Profile = "gonggamline-admin",
    [string]$Region = "ap-southeast-1",
    [string]$StackName = "gonggamline-independent-backup-v1"
)

$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot ".." )).Path
$env:AWS_CONFIG_FILE = Join-Path $RepoRoot ".aws\\config"
$env:AWS_SHARED_CREDENTIALS_FILE = Join-Path $RepoRoot ".aws\\credentials"
$env:AWS_SDK_LOAD_CONFIG = "1"

$ExpectedAdds = @(
    "BackupBucket",
    "BackupBucketPolicy",
    "BackupDeadLetterQueue",
    "BackupImageRepository",
    "BackupKey",
    "BackupKeyAlias"
)
$ExpectedOmitted = @(
    "BackupDeadLetterAlarm",
    "BackupDeadLetterQueuePolicy",
    "BackupLogGroup",
    "BackupSchedule",
    "BackupSchedulerRole",
    "BackupWorker",
    "BackupWorkerAsyncFailure",
    "BackupWorkerRole"
)

function Invoke-Aws {
    param([string[]]$AwsArgs, [string]$Label = "")
    Write-Host "CMD: $($AWS_EXE) $($AwsArgs -join ' ')"
    $raw = ""
    $oldErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        $result = & $AWS_EXE @AwsArgs 2>&1
    } finally {
        $ErrorActionPreference = $oldErrorActionPreference
    }
    if ($LASTEXITCODE -ne 0) {
        if ($result) {
            $raw = $result | Out-String
        }
        $message = if ($Label) { "$Label failed. " } else { "" }
        throw "$message$raw"
    }
    return ($result | Out-String | ConvertFrom-Json)
}

Write-Host "1) Environment check"
if (-not (Test-Path $AWS_EXE)) {
    throw "AWS CLI not found: $AWS_EXE"
}
if (-not (Test-Path (Join-Path $RepoRoot ".aws/config"))) {
    throw ".aws/config not found. Run scripts/codex-aws-bootstrap.ps1 first."
}

try {
    $profilesRaw = & $AWS_EXE configure list-profiles 2>&1 | Out-String
    $profiles = ($profilesRaw -split "`r?`n") | Where-Object { $_ -and $_.Trim() }
    if ($profiles -notcontains $Profile) {
        throw "Profile '$Profile' not found."
    }
} catch {
    throw "Failed to read AWS profile list. $_"
}

Write-Host "2) AWS caller identity"
$identity = Invoke-Aws @("sts","get-caller-identity","--profile",$Profile,"--region",$Region,"--output","json") "caller identity"
Write-Host "   Account: $($identity.Account)"
Write-Host "   Arn: $($identity.Arn)"

Write-Host "3) Stack status check"
$stack = Invoke-Aws @(
    "cloudformation","describe-stacks",
    "--profile",$Profile,
    "--region",$Region,
    "--stack-name",$StackName,
    "--output","json"
) "describe-stacks"
$stackInfo = $stack.Stacks[0]
Write-Host "   Stack status: $($stackInfo.StackStatus)"
if ($stackInfo.StackStatus -ne "CREATE_COMPLETE") {
    throw "Unexpected stack status: $($stackInfo.StackStatus)"
}

Write-Host "4) ChangeSet metadata"
if ($stackInfo.ChangeSetId) {
    Write-Host "   Latest ChangeSetId: $($stackInfo.ChangeSetId)"
}

Write-Host "5) Stack resources check"
$resources = Invoke-Aws @(
    "cloudformation","describe-stack-resources",
    "--profile",$Profile,
    "--region",$Region,
    "--stack-name",$StackName,
    "--output","json"
) "describe-stack-resources"

$stackResources = @($resources.StackResources)
$existing = $stackResources | ForEach-Object { $_.LogicalResourceId } | Sort-Object -Unique
Write-Host "   Total resources: $($existing.Count)"

$missing = $ExpectedAdds | Where-Object { $existing -notcontains $_ }
$omitted = $ExpectedOmitted | Where-Object { $existing -contains $_ }

if ($missing.Count -gt 0) {
    Write-Host "Missing expected base resources: $($missing -join ', ')" -ForegroundColor Red
    Write-Host "Next checks:"
    Write-Host "  - aws cloudformation describe-stack-events --stack-name $StackName --region $Region --profile $Profile"
    Write-Host "  - aws cloudformation get-template-summary --stack-name $StackName --region $Region --profile $Profile"
    throw "Missing expected base resources."
}
if ($omitted.Count -gt 0) {
    Write-Host "Unexpected omitted resources present: $($omitted -join ', ')" -ForegroundColor Red
    throw "Unexpected omitted resources present."
}
$incomplete = $stackResources | Where-Object { $_.ResourceStatus -ne "CREATE_COMPLETE" }
if ($incomplete.Count -gt 0) {
    throw "Base resources not CREATE_COMPLETE: $(($incomplete | ForEach-Object { $_.LogicalResourceId }) -join ', ')"
}
Write-Host "   Expected base resource set matches."

Write-Host "6) Parameter capability sanity"
if ($stackInfo.Parameters) {
    $paramMap = @{}
    foreach ($item in $stackInfo.Parameters) {
        $paramMap[$item.ParameterKey] = $item.ParameterValue
    }
    Write-Host "   EnableWorkerResources: $($paramMap.EnableWorkerResources)"
    Write-Host "   BackupWorkerImageUri: $($paramMap.BackupWorkerImageUri)"
    Write-Host "   ProductionDatabaseSecretArn: $($paramMap.ProductionDatabaseSecretArn)"
}

if (($stackInfo.Capabilities | Where-Object { $_ -eq "CAPABILITY_NAMED_IAM" }) -eq $null) {
    throw "CAPABILITY_NAMED_IAM not present on stack."
}

Write-Host "7) Done"
Write-Host "PASS: AWS backup base boundary validation complete."
