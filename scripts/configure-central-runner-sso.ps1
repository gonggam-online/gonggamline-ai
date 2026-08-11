param(
  [string]$AwsConfigRoot = "D:\Dev\gonggamline-ai",
  [string]$Region = "ap-northeast-2",
  [string]$AccountId = "205382053735"
)

$ErrorActionPreference = "Stop"
$configPath = Join-Path $AwsConfigRoot ".aws\config"
if (-not (Test-Path -LiteralPath $configPath)) { throw "AWS SSO config not found." }
$config = Get-Content -LiteralPath $configPath -Raw
$startUrlMatch = [regex]::Match($config, "(?m)^sso_start_url\s*=\s*(.+)$")
if (-not $startUrlMatch.Success) { throw "Existing SSO start URL not found." }
$startUrl = $startUrlMatch.Groups[1].Value.Trim()

function Upsert-Profile([string]$Name, [string]$PermissionSetName) {
  $sectionPattern = "(?ms)^\[profile " + [regex]::Escape($Name) + "\].*?(?=^\[|\z)"
  $section = @"
[profile $Name]
region = $Region
output = json
sso_start_url = $startUrl
sso_region = $Region
sso_registration_scopes = sso:account:access
sso_account_id = $AccountId
sso_role_name = $PermissionSetName
"@
  if ([regex]::IsMatch($script:config, $sectionPattern)) {
    $script:config = [regex]::Replace($script:config, $sectionPattern, $section + "`r`n")
  } else {
    $script:config = $script:config.TrimEnd() + "`r`n`r`n" + $section + "`r`n"
  }
}

Upsert-Profile "gonggamline-central-runner" "GonggamCentralRunnerDesktop"
Upsert-Profile "gonggamline-central-producer" "GonggamCentralRunnerLaptop"
[IO.File]::WriteAllText($configPath, $config, (New-Object Text.UTF8Encoding($false)))
Write-Host "Central runner SSO profiles configured."
