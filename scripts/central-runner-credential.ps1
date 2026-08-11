param(
  [ValidateSet("Set", "Run", "Status", "SelfTest")]
  [string]$Action,
  [string]$Command,
  [string[]]$CommandArguments,
  [string]$StorePath = (Join-Path $env:LOCALAPPDATA "GonggamLine\central-runner.credentials.json")
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Security
$entropy = [Text.Encoding]::UTF8.GetBytes("GonggamLine.CentralRunner.Coupang.v1")
$scope = [Security.Cryptography.DataProtectionScope]::CurrentUser

function Protect-Text([string]$Value) {
  $plain = [Text.Encoding]::UTF8.GetBytes($Value)
  try {
    return [Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect($plain, $entropy, $scope))
  } finally {
    [Array]::Clear($plain, 0, $plain.Length)
  }
}

function Unprotect-Text([string]$Value) {
  $cipher = [Convert]::FromBase64String($Value)
  $plain = [Security.Cryptography.ProtectedData]::Unprotect($cipher, $entropy, $scope)
  try { return [Text.Encoding]::UTF8.GetString($plain) }
  finally { [Array]::Clear($plain, 0, $plain.Length) }
}

function Read-Secret([string]$Prompt) {
  $secure = Read-Host $Prompt -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

function Read-Store {
  if (-not (Test-Path -LiteralPath $StorePath)) { throw "CREDENTIAL_STORE_UNAVAILABLE" }
  return Get-Content -LiteralPath $StorePath -Raw | ConvertFrom-Json
}

if ($Action -eq "SelfTest") {
  $value = [Guid]::NewGuid().ToString("N")
  $roundTrip = Unprotect-Text (Protect-Text $value)
  if ($roundTrip -ne $value) { throw "DPAPI round trip failed." }
  Write-Host "Windows DPAPI self-test passed."
  exit 0
}

if ($Action -eq "Set") {
  $accessKey = Read-Secret "Coupang access key"
  $secretKey = Read-Secret "Coupang secret key"
  $vendorId = Read-Secret "Coupang vendor ID"
  $parent = Split-Path -Parent $StorePath
  New-Item -ItemType Directory -Path $parent -Force | Out-Null
  $payload = [ordered]@{
    version = 1
    accessKey = Protect-Text $accessKey
    secretKey = Protect-Text $secretKey
    vendorId = Protect-Text $vendorId
  } | ConvertTo-Json -Compress
  [IO.File]::WriteAllText($StorePath, $payload, (New-Object Text.UTF8Encoding($false)))
  $currentUserSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  & icacls.exe $StorePath /inheritance:r /grant:r "*$currentUserSid`:(F)" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Unable to secure the credential store ACL." }
  Write-Host "Coupang credentials saved with Windows DPAPI."
  exit 0
}

if ($Action -eq "Status") {
  try {
    $store = Read-Store
    $states = [ordered]@{
      AccessKey = -not [string]::IsNullOrWhiteSpace((Unprotect-Text $store.accessKey))
      SecretKey = -not [string]::IsNullOrWhiteSpace((Unprotect-Text $store.secretKey))
      VendorId = -not [string]::IsNullOrWhiteSpace((Unprotect-Text $store.vendorId))
    }
    foreach ($entry in $states.GetEnumerator()) { Write-Host "$($entry.Key): $(if ($entry.Value) { 'configured' } else { 'missing' })" }
  } catch {
    Write-Host "AccessKey: missing"
    Write-Host "SecretKey: missing"
    Write-Host "VendorId: missing"
  }
  exit 0
}

if (-not $Command) { throw "Command is required for Run." }
$stored = Read-Store
$env:COUPANG_ACCESS_KEY = Unprotect-Text $stored.accessKey
$env:COUPANG_SECRET_KEY = Unprotect-Text $stored.secretKey
$env:COUPANG_VENDOR_ID = Unprotect-Text $stored.vendorId
try {
  & $Command @CommandArguments
  exit $LASTEXITCODE
} finally {
  Remove-Item Env:COUPANG_ACCESS_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:COUPANG_SECRET_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:COUPANG_VENDOR_ID -ErrorAction SilentlyContinue
}
