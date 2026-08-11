param(
  [Parameter(Mandatory = $true)][string]$RepositoryRoot,
  [Parameter(Mandatory = $true)][string]$RequestQueueUrl,
  [Parameter(Mandatory = $true)][string]$ResponseQueueUrl,
  [string]$AwsProfile = "gonggamline-central-runner",
  [string]$Region = "ap-southeast-1",
  [string]$AwsConfigRoot = "D:\Dev\gonggamline-ai",
  [string]$CredentialStorePath = (Join-Path $env:LOCALAPPDATA "GonggamLine\central-runner.credentials.json")
)

$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $RepositoryRoot
$env:AWS_PROFILE = $AwsProfile
$env:AWS_REGION = $Region
$env:AWS_CONFIG_FILE = Join-Path $AwsConfigRoot ".aws\config"
$env:AWS_SHARED_CREDENTIALS_FILE = Join-Path $AwsConfigRoot ".aws\credentials"
$env:AWS_SDK_LOAD_CONFIG = "1"
$env:CENTRAL_RUNNER_REQUEST_QUEUE_URL = $RequestQueueUrl
$env:CENTRAL_RUNNER_RESPONSE_QUEUE_URL = $ResponseQueueUrl

$credentialScript = Join-Path $RepositoryRoot "scripts\central-runner-credential.ps1"
$logPath = Join-Path (Split-Path -Parent $CredentialStorePath) "central-runner.log"
& $credentialScript `
  -Action Run `
  -StorePath $CredentialStorePath `
  -Command "npm.cmd" `
  -CommandArguments @("run", "central-runner:start") *>> $logPath
exit $LASTEXITCODE
