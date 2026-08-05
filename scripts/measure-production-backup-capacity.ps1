param(
    [string]$ResultPath = ".local-state/aws-capacity-measurement/result-v2.json"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$image = "postgres@sha256:00bc86618629af00d2937fdc5a5d63db3ff8450acf52f0636ec813c7f4902929"
$databaseHost = "aws-0-ap-southeast-1.pooler.supabase.com"
$databasePort = "5432"
$databaseName = "postgres"
$databaseUser = "postgres.sxvtznmoemrcwifungnb"
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$allowedResultRoot = [IO.Path]::GetFullPath(
    (Join-Path $repositoryRoot ".local-state/aws-capacity-measurement")
)
$resolvedResultPath = if ([IO.Path]::IsPathRooted($ResultPath)) {
    [IO.Path]::GetFullPath($ResultPath)
} else {
    [IO.Path]::GetFullPath((Join-Path $repositoryRoot $ResultPath))
}

if (-not $resolvedResultPath.StartsWith(
    $allowedResultRoot + [IO.Path]::DirectorySeparatorChar,
    [StringComparison]::OrdinalIgnoreCase
)) {
    throw "ResultPath must be inside the approved ignored measurement directory."
}

if (Test-Path -LiteralPath $resolvedResultPath) {
    throw "The result path already exists; refusing to overwrite measurement evidence."
}

$resultDirectory = Split-Path -Parent $resolvedResultPath
New-Item -ItemType Directory -Path $resultDirectory -Force | Out-Null

$attemptId = [Guid]::NewGuid().ToString("N")
$temporaryRoot = [IO.Path]::GetTempPath()
$temporaryDirectory = Join-Path $temporaryRoot "gonggamline-aws-capacity-$attemptId"
$credentialPath = Join-Path $temporaryDirectory "pgpass"
$archiveDirectory = Join-Path $temporaryDirectory "archive"
$archivePath = Join-Path $archiveDirectory "capacity.dump"
$dumpErrorPath = Join-Path $temporaryDirectory "dump.stderr"
$restoreErrorPath = Join-Path $temporaryDirectory "restore.stderr"
$dumpContainer = "gonggamline-capacity-dump-$attemptId"
$restoreContainer = "gonggamline-capacity-restore-$attemptId"

$result = [ordered]@{
    schemaVersion = "gonggamline-aws-backup-capacity-result-v2"
    status = "FAILED_CLOSED"
    attemptedAt = [DateTime]::UtcNow.ToString("o")
    measuredAt = $null
    pgDumpVersion = $null
    archiveCreated = $false
    archiveBytes = $null
    dumpDurationSeconds = $null
    archiveListEntryCount = $null
    warningCount = $null
    resultEvidenceAvailable = $true
    failureClass = "RUNNER_PRECONDITION_FAILED"
    transientArchiveDeleted = $false
    credentialFileDeleted = $false
    temporaryDirectoryDeleted = $false
    dumpContainerDeleted = $false
    restoreContainerDeleted = $false
    databaseMutationPerformed = $false
    rawArchiveStoredRemotely = $false
    rowContentInspected = $false
}

$exitCode = 1
$dumpContainerStarted = $false
$restoreContainerStarted = $false

function Get-NonEmptyLineCount {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        return 0
    }

    return @(
        Get-Content -LiteralPath $Path -ErrorAction Stop |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    ).Count
}

function Remove-ExactMeasurementContainer {
    param([string]$Name)

    if (-not $Name.StartsWith("gonggamline-capacity-", [StringComparison]::Ordinal)) {
        throw "Refusing to clean an unexpected container name."
    }

    $matchingIds = @(
        & docker ps -aq --filter "name=^/$Name$" 2>$null |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    )
    if ($matchingIds.Count -gt 0) {
        & docker rm -f $Name 2>$null | Out-Null
    }

    return @(
        & docker ps -aq --filter "name=^/$Name$" 2>$null |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    ).Count -eq 0
}

try {
    if ([string]::IsNullOrEmpty($env:SUPABASE_DB_PASSWORD)) {
        throw "The process-scoped database credential is absent."
    }

    $versionOutput = @(
        & docker run --rm --pull never --network none $image pg_dump --version 2>$null
    )
    if ($LASTEXITCODE -ne 0 -or ($versionOutput -join " ") -notmatch "PostgreSQL\) 17\.6(?:\s|$)") {
        $result.failureClass = "POSTGRES_CLIENT_VERSION_MISMATCH"
        throw "The pinned PostgreSQL 17.6 client is unavailable."
    }
    $result.pgDumpVersion = "17.6"

    New-Item -ItemType Directory -Path $temporaryDirectory -Force | Out-Null
    New-Item -ItemType Directory -Path $archiveDirectory -Force | Out-Null

    $operator = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl = New-Object Security.AccessControl.DirectorySecurity
    $acl.SetOwner($operator)
    $acl.SetAccessRuleProtection($true, $false)
    $operatorRule = New-Object Security.AccessControl.FileSystemAccessRule(
        $operator,
        [Security.AccessControl.FileSystemRights]::FullControl,
        [Security.AccessControl.InheritanceFlags]"ContainerInherit, ObjectInherit",
        [Security.AccessControl.PropagationFlags]::None,
        [Security.AccessControl.AccessControlType]::Allow
    )
    $systemRule = New-Object Security.AccessControl.FileSystemAccessRule(
        (New-Object Security.Principal.SecurityIdentifier("S-1-5-18")),
        [Security.AccessControl.FileSystemRights]::FullControl,
        [Security.AccessControl.InheritanceFlags]"ContainerInherit, ObjectInherit",
        [Security.AccessControl.PropagationFlags]::None,
        [Security.AccessControl.AccessControlType]::Allow
    )
    $acl.AddAccessRule($operatorRule)
    $acl.AddAccessRule($systemRule)
    Set-Acl -LiteralPath $temporaryDirectory -AclObject $acl

    $escapedPassword = $env:SUPABASE_DB_PASSWORD.Replace("\", "\\").Replace(":", "\:")
    $pgpass = "$databaseHost`:$databasePort`:$databaseName`:$databaseUser`:$escapedPassword`n"
    [IO.File]::WriteAllText($credentialPath, $pgpass, (New-Object Text.UTF8Encoding($false)))
    $pgpass = $null
    $escapedPassword = $null
    $env:SUPABASE_DB_PASSWORD = $null

    $dumpScript = @'
cp /input/pgpass /run/secure/pgpass
chmod 600 /run/secure/pgpass
export PGPASSFILE=/run/secure/pgpass
exec timeout --signal=TERM 900s pg_dump \
  --host "$1" \
  --port "$2" \
  --username "$3" \
  --dbname "$4" \
  --format custom \
  --file /output/capacity.dump
'@

    $dumpArguments = @(
        "run", "--rm", "--pull", "never",
        "--name", $dumpContainer,
        "--read-only",
        "--security-opt", "no-new-privileges",
        "--cap-drop", "ALL",
        "--memory", "512m",
        "--cpus", "1",
        "--pids-limit", "128",
        "--tmpfs", "/run/secure:rw,noexec,nosuid,nodev,size=65536,mode=0700",
        "--tmpfs", "/tmp:rw,noexec,nosuid,nodev,size=67108864",
        "--mount", "type=bind,src=$credentialPath,dst=/input/pgpass,readonly",
        "--mount", "type=bind,src=$archiveDirectory,dst=/output",
        "--env", "PGSSLMODE=require",
        $image,
        "sh", "-ceu", $dumpScript, "measure",
        $databaseHost, $databasePort, $databaseUser, $databaseName
    )

    $timer = [Diagnostics.Stopwatch]::StartNew()
    $dumpContainerStarted = $true
    & docker @dumpArguments 2> $dumpErrorPath
    $dumpExitCode = $LASTEXITCODE
    $timer.Stop()
    $result.dumpDurationSeconds = [Math]::Round($timer.Elapsed.TotalSeconds, 3)

    $dumpWarningCount = Get-NonEmptyLineCount -Path $dumpErrorPath
    $result.warningCount = $dumpWarningCount

    if ($dumpExitCode -eq 124) {
        $result.failureClass = "DUMP_TIMEOUT"
        throw "The bounded dump timed out."
    }
    if ($dumpExitCode -ne 0) {
        $dumpErrorText = if (Test-Path -LiteralPath $dumpErrorPath) {
            Get-Content -Raw -LiteralPath $dumpErrorPath
        } else {
            ""
        }
        $result.failureClass = if ($dumpErrorText -match "password authentication failed") {
            "EXTERNAL_CONFIGURATION_DATABASE_CREDENTIAL_AUTHENTICATION"
        } else {
            "DUMP_FAILED"
        }
        throw "The bounded dump failed closed."
    }
    if ($dumpWarningCount -ne 0) {
        $result.failureClass = "DUMP_WARNING_REQUIRES_REVIEW"
        throw "The dump emitted warning or error output."
    }
    if (-not (Test-Path -LiteralPath $archivePath -PathType Leaf)) {
        $result.failureClass = "ARCHIVE_MISSING"
        throw "The expected archive was not created."
    }

    $archive = Get-Item -LiteralPath $archivePath
    $result.archiveCreated = $true
    $result.archiveBytes = $archive.Length
    if ($archive.Length -le 0) {
        $result.failureClass = "ARCHIVE_EMPTY"
        throw "The archive is empty."
    }

    $restoreArguments = @(
        "run", "--rm", "--pull", "never",
        "--name", $restoreContainer,
        "--network", "none",
        "--read-only",
        "--security-opt", "no-new-privileges",
        "--cap-drop", "ALL",
        "--memory", "256m",
        "--cpus", "1",
        "--pids-limit", "64",
        "--mount", "type=bind,src=$archiveDirectory,dst=/input,readonly",
        $image,
        "pg_restore", "--list", "/input/capacity.dump"
    )
    $restoreContainerStarted = $true
    $archiveList = @(& docker @restoreArguments 2> $restoreErrorPath)
    $restoreExitCode = $LASTEXITCODE
    $restoreWarningCount = Get-NonEmptyLineCount -Path $restoreErrorPath
    $result.warningCount = $dumpWarningCount + $restoreWarningCount

    if ($restoreExitCode -ne 0) {
        $result.failureClass = "ARCHIVE_LIST_VALIDATION_FAILED"
        throw "Offline archive-list validation failed."
    }
    if ($restoreWarningCount -ne 0) {
        $result.failureClass = "ARCHIVE_LIST_WARNING_REQUIRES_REVIEW"
        throw "Offline archive-list validation emitted output on standard error."
    }

    $result.archiveListEntryCount = @(
        $archiveList | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    ).Count
    $archiveList = $null
    if ($result.archiveListEntryCount -le 0) {
        $result.failureClass = "ARCHIVE_LIST_EMPTY"
        throw "Offline archive-list validation returned no entries."
    }

    $result.status = "SUCCEEDED"
    $result.failureClass = $null
    $result.measuredAt = [DateTime]::UtcNow.ToString("o")
    $exitCode = 0
} catch {
    if ($result.failureClass -eq "RUNNER_PRECONDITION_FAILED") {
        $result.failureClass = "RUNNER_FAILED_CLOSED"
    }
    $exitCode = 1
} finally {
    $env:SUPABASE_DB_PASSWORD = $null

    if ($dumpContainerStarted) {
        try {
            $result.dumpContainerDeleted = Remove-ExactMeasurementContainer -Name $dumpContainer
        } catch {
            $result.dumpContainerDeleted = $false
        }
    } else {
        $result.dumpContainerDeleted = $true
    }
    if ($restoreContainerStarted) {
        try {
            $result.restoreContainerDeleted = Remove-ExactMeasurementContainer -Name $restoreContainer
        } catch {
            $result.restoreContainerDeleted = $false
        }
    } else {
        $result.restoreContainerDeleted = $true
    }

    if (Test-Path -LiteralPath $archivePath) {
        Remove-Item -LiteralPath $archivePath -Force -ErrorAction SilentlyContinue
    }
    $result.transientArchiveDeleted = -not (Test-Path -LiteralPath $archivePath)

    if (Test-Path -LiteralPath $credentialPath) {
        Remove-Item -LiteralPath $credentialPath -Force -ErrorAction SilentlyContinue
    }
    $result.credentialFileDeleted = -not (Test-Path -LiteralPath $credentialPath)

    $expectedPrefix = [IO.Path]::GetFullPath($temporaryRoot) +
        "gonggamline-aws-capacity-"
    $resolvedTemporaryDirectory = [IO.Path]::GetFullPath($temporaryDirectory)
    if ($resolvedTemporaryDirectory.StartsWith($expectedPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        Remove-Item -LiteralPath $temporaryDirectory -Recurse -Force -ErrorAction SilentlyContinue
    }
    $result.temporaryDirectoryDeleted = -not (Test-Path -LiteralPath $temporaryDirectory)

    if (
        -not $result.transientArchiveDeleted -or
        -not $result.credentialFileDeleted -or
        -not $result.temporaryDirectoryDeleted -or
        -not $result.dumpContainerDeleted -or
        -not $result.restoreContainerDeleted
    ) {
        $result.status = "FAILED_CLEANUP_INCIDENT"
        $result.failureClass = "CLEANUP_INCOMPLETE"
        $exitCode = 1
    }

    $json = $result | ConvertTo-Json -Depth 4
    [IO.File]::WriteAllText($resolvedResultPath, $json + "`n", (New-Object Text.UTF8Encoding($false)))
    Write-Output "MEASUREMENT_RESULT_READY"
}

exit $exitCode
