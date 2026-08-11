param(
  [Parameter(Mandatory = $true)][string]$InstanceArn,
  [Parameter(Mandatory = $true)][string]$AccountId,
  [Parameter(Mandatory = $true)][string]$PrincipalId,
  [Parameter(Mandatory = $true)][string]$RequestQueueArn,
  [Parameter(Mandatory = $true)][string]$ResponseQueueArn,
  [string]$Region = "ap-southeast-1",
  [string]$Profile = "gonggamline-admin",
  [string]$AwsExe = "C:\Program Files\Amazon\AWSCLIV2\aws.exe",
  [string]$AwsConfigRoot = "D:\Dev\gonggamline-ai"
)

$ErrorActionPreference = "Stop"
$env:AWS_CONFIG_FILE = Join-Path $AwsConfigRoot ".aws\config"
$env:AWS_SHARED_CREDENTIALS_FILE = Join-Path $AwsConfigRoot ".aws\credentials"
$env:AWS_SDK_LOAD_CONFIG = "1"

function Invoke-Aws([string[]]$Arguments) {
  $priorPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $text = (& $AwsExe @Arguments 2>&1 | Out-String).Trim()
  $ErrorActionPreference = $priorPreference
  if ($LASTEXITCODE -ne 0) { throw $text }
  if ([string]::IsNullOrWhiteSpace($text)) { return $null }
  return $text | ConvertFrom-Json
}

function Find-PermissionSet([string]$Name) {
  $listed = Invoke-Aws @("sso-admin", "list-permission-sets", "--instance-arn", $InstanceArn, "--region", $Region, "--profile", $Profile, "--output", "json")
  foreach ($arn in $listed.PermissionSets) {
    $description = Invoke-Aws @("sso-admin", "describe-permission-set", "--instance-arn", $InstanceArn, "--permission-set-arn", $arn, "--region", $Region, "--profile", $Profile, "--output", "json")
    if ($description.PermissionSet.Name -eq $Name) { return $arn }
  }
  return $null
}

function Ensure-PermissionSet([string]$Name, [hashtable]$Policy) {
  $arn = Find-PermissionSet $Name
  if (-not $arn) {
    $created = Invoke-Aws @("sso-admin", "create-permission-set", "--instance-arn", $InstanceArn, "--name", $Name, "--description", "Least privilege GonggamLine central runner queue access", "--session-duration", "PT8H", "--region", $Region, "--profile", $Profile, "--output", "json")
    $arn = $created.PermissionSet.PermissionSetArn
  }
  $policyJson = $Policy | ConvertTo-Json -Depth 10 -Compress
  $policyPath = [IO.Path]::GetTempFileName()
  try {
    [IO.File]::WriteAllText($policyPath, $policyJson, (New-Object Text.UTF8Encoding($false)))
    $policyUri = "file://" + ($policyPath -replace "\\", "/")
    [void](Invoke-Aws @("sso-admin", "put-inline-policy-to-permission-set", "--instance-arn", $InstanceArn, "--permission-set-arn", $arn, "--inline-policy", $policyUri, "--region", $Region, "--profile", $Profile, "--output", "json"))
  } finally {
    Remove-Item -LiteralPath $policyPath -Force -ErrorAction SilentlyContinue
  }
  [void](Invoke-Aws @("sso-admin", "provision-permission-set", "--instance-arn", $InstanceArn, "--permission-set-arn", $arn, "--target-type", "AWS_ACCOUNT", "--target-id", $AccountId, "--region", $Region, "--profile", $Profile, "--output", "json"))
  $assignments = Invoke-Aws @("sso-admin", "list-account-assignments", "--instance-arn", $InstanceArn, "--permission-set-arn", $arn, "--account-id", $AccountId, "--region", $Region, "--profile", $Profile, "--output", "json")
  $exists = @($assignments.AccountAssignments | Where-Object { $_.PrincipalId -eq $PrincipalId -and $_.PrincipalType -eq "USER" }).Count -gt 0
  if (-not $exists) {
    [void](Invoke-Aws @("sso-admin", "create-account-assignment", "--instance-arn", $InstanceArn, "--target-id", $AccountId, "--target-type", "AWS_ACCOUNT", "--permission-set-arn", $arn, "--principal-type", "USER", "--principal-id", $PrincipalId, "--region", $Region, "--profile", $Profile, "--output", "json"))
  }
  return $arn
}

$desktopPolicy = @{
  Version = "2012-10-17"
  Statement = @(
    @{ Effect = "Allow"; Action = @("sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:ChangeMessageVisibility", "sqs:GetQueueAttributes", "sqs:GetQueueUrl"); Resource = $RequestQueueArn },
    @{ Effect = "Allow"; Action = @("sqs:SendMessage", "sqs:GetQueueAttributes", "sqs:GetQueueUrl"); Resource = $ResponseQueueArn }
  )
}
$laptopPolicy = @{
  Version = "2012-10-17"
  Statement = @(
    @{ Effect = "Allow"; Action = @("sqs:SendMessage", "sqs:GetQueueAttributes", "sqs:GetQueueUrl"); Resource = $RequestQueueArn },
    @{ Effect = "Allow"; Action = @("sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:ChangeMessageVisibility", "sqs:GetQueueAttributes", "sqs:GetQueueUrl"); Resource = $ResponseQueueArn }
  )
}

$desktopArn = Ensure-PermissionSet "GonggamCentralRunnerDesktop" $desktopPolicy
$laptopArn = Ensure-PermissionSet "GonggamCentralRunnerLaptop" $laptopPolicy
[pscustomobject]@{ DesktopPermissionSetArn = $desktopArn; LaptopPermissionSetArn = $laptopArn } | ConvertTo-Json
