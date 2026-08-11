param(
  [Parameter(Mandatory = $true)][string]$RequestQueueUrl,
  [Parameter(Mandatory = $true)][string]$ResponseQueueUrl,
  [string]$AwsProfile = "gonggamline-central-runner",
  [string]$Region = "ap-southeast-1",
  [string]$AwsConfigRoot = "D:\Dev\gonggamline-ai",
  [string]$CredentialStorePath = (Join-Path $env:LOCALAPPDATA "GonggamLine\central-runner.credentials.json")
)

$ErrorActionPreference = "Stop"
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$taskName = "GonggamLine Central Runner"
$startScript = Join-Path $repositoryRoot "scripts\start-central-runner.ps1"
$quoted = @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-File", ('"' + $startScript + '"'),
  "-RepositoryRoot", ('"' + $repositoryRoot + '"'),
  "-RequestQueueUrl", ('"' + $RequestQueueUrl + '"'),
  "-ResponseQueueUrl", ('"' + $ResponseQueueUrl + '"'),
  "-AwsProfile", ('"' + $AwsProfile + '"'),
  "-Region", ('"' + $Region + '"'),
  "-AwsConfigRoot", ('"' + $AwsConfigRoot + '"')
  "-CredentialStorePath", ('"' + $CredentialStorePath + '"')
) -join " "

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $quoted -WorkingDirectory $repositoryRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet `
  -ExecutionTimeLimit (New-TimeSpan -Days 3650) `
  -RestartCount 999 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Write-Host "Scheduled task installed: $taskName"
