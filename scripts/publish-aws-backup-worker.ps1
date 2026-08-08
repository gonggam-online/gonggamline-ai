param(
  [string]$Profile = "gonggamline-admin",
  [string]$Region = "ap-southeast-1",
  [string]$StackName = "gonggamline-independent-backup-v1",
  [string]$DockerExe = "C:\Users\gongg\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe",
  [string]$AwsExe = "C:\Program Files\Amazon\AWSCLIV2\aws.exe"
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $RepoRoot

if (-not (Test-Path -LiteralPath $DockerExe)) { throw "Docker CLI not found: $DockerExe" }
if (-not (Test-Path -LiteralPath $AwsExe)) { throw "AWS CLI not found: $AwsExe" }
$trackedStatus = & git status --porcelain --untracked-files=no
if ($LASTEXITCODE -ne 0 -or $trackedStatus) { throw "Tracked worktree must be clean before publishing." }

$commit = (& git rev-parse --short=12 HEAD).Trim()
$repositoryUri = (& $AwsExe cloudformation describe-stacks --profile $Profile --region $Region `
  --stack-name $StackName `
  --query "Stacks[0].Outputs[?OutputKey=='BackupImageRepositoryUri'].OutputValue | [0]" `
  --output text).Trim()
if ($LASTEXITCODE -ne 0 -or -not $repositoryUri -or $repositoryUri -eq "None") {
  throw "BackupImageRepositoryUri output is unavailable."
}
$registry = $repositoryUri.Split('/')[0]
$repositoryName = $repositoryUri.Substring($repositoryUri.IndexOf('/') + 1)
$tag = "git-$commit"
$taggedImage = "${repositoryUri}:$tag"

Write-Host "1) Build exact worker bundle and linux/amd64 image"
npm.cmd run cloud:aws-backup:worker-build
if ($LASTEXITCODE -ne 0) { throw "Worker bundle failed." }
& $DockerExe buildx build --platform linux/amd64 --provenance=false --load `
  -f infra/aws-backup/worker/Dockerfile -t $taggedImage .
if ($LASTEXITCODE -ne 0) { throw "Docker build failed." }

Write-Host "2) Authenticate and push immutable ECR tag"
$password = & $AwsExe ecr get-login-password --profile $Profile --region $Region
if ($LASTEXITCODE -ne 0 -or -not $password) { throw "ECR login password unavailable." }
$password | & $DockerExe login --username AWS --password-stdin $registry | Out-Host
$password = $null
if ($LASTEXITCODE -ne 0) { throw "ECR login failed." }
& $DockerExe push $taggedImage
if ($LASTEXITCODE -ne 0) { throw "ECR push failed." }

$digest = (& $AwsExe ecr describe-images --profile $Profile --region $Region `
  --repository-name $repositoryName --image-ids "imageTag=$tag" `
  --query "imageDetails[0].imageDigest" --output text).Trim()
if ($LASTEXITCODE -ne 0 -or $digest -notmatch '^sha256:[a-f0-9]{64}$') {
  throw "ECR digest unavailable after push."
}

Write-Host "3) Wait for scan and reject critical/high findings"
$savedErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$scanStatus = (& $AwsExe ecr describe-image-scan-findings --profile $Profile --region $Region `
  --repository-name $repositoryName --image-id "imageDigest=$digest" `
  --query "imageScanStatus.status" --output text 2>$null).Trim()
$ErrorActionPreference = $savedErrorActionPreference
if ($scanStatus -ne "COMPLETE") {
  & $AwsExe ecr start-image-scan --profile $Profile --region $Region `
    --repository-name $repositoryName --image-id "imageDigest=$digest" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "ECR image scan could not be started." }
  & $AwsExe ecr wait image-scan-complete --profile $Profile --region $Region `
    --repository-name $repositoryName --image-id "imageDigest=$digest"
  if ($LASTEXITCODE -ne 0) { throw "ECR image scan did not complete." }
}
$severityCounts = (& $AwsExe ecr describe-image-scan-findings --profile $Profile --region $Region `
  --repository-name $repositoryName --image-id "imageDigest=$digest" `
  --query "[imageScanFindings.findingSeverityCounts.CRITICAL,imageScanFindings.findingSeverityCounts.HIGH]" `
  --output text).Trim().Split()
if ($LASTEXITCODE -ne 0 -or $severityCounts.Count -ne 2) {
  throw "ECR scan findings unavailable."
}
$critical = if ($severityCounts[0] -eq "None") { 0 } else { [int]$severityCounts[0] }
$high = if ($severityCounts[1] -eq "None") { 0 } else { [int]$severityCounts[1] }
Write-Host "   Scan CRITICAL=$critical HIGH=$high"
if ($critical -gt 0 -or $high -gt 0) { throw "Image scan rejected the worker image." }

Write-Host "WORKER_IMAGE_URI=${repositoryUri}@${digest}"
