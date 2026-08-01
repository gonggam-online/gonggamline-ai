param([string]$ImageTag = "gonggamline/r3-supabase-cli:2.110.0")

$ErrorActionPreference = "Stop"
$version = "2.110.0"
$artifactSha256 = "876f439e85d296bf095d906ca91cadeb5509d753b4d98ee823e5752d578ff92b"
$artifactUrl = "https://github.com/supabase/cli/releases/download/v$version/supabase_2.110.0_linux_amd64.tar.gz"
$baseImage = "debian@sha256:7b140f374b289a7c2befc338f42ebe6441b7ea838a042bbd5acbfca6ec875818"
$buildRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("r3-cli-sidecar-" + [guid]::NewGuid().ToString("N"))

try {
  New-Item -ItemType Directory -Path $buildRoot | Out-Null
  $archive = Join-Path $buildRoot "supabase.tar.gz"
  Invoke-WebRequest -Uri $artifactUrl -OutFile $archive -UseBasicParsing
  if ((Get-FileHash -Algorithm SHA256 -LiteralPath $archive).Hash.ToLowerInvariant() -ne $artifactSha256) {
    throw "Supabase CLI artifact digest mismatch."
  }
  tar -xzf $archive -C $buildRoot supabase
  @"
FROM $baseImage
COPY supabase /usr/local/bin/supabase
COPY entrypoint.sh /usr/local/bin/r3-entrypoint
RUN groupadd --gid 65532 r3cli && useradd --uid 65532 --gid 65532 --no-create-home --shell /usr/sbin/nologin r3cli && chmod 0555 /usr/local/bin/supabase /usr/local/bin/r3-entrypoint
USER 65532:65532
ENTRYPOINT ["/usr/local/bin/r3-entrypoint"]
"@ | Set-Content -LiteralPath (Join-Path $buildRoot "Dockerfile") -Encoding ascii
  @'
#!/bin/sh
set -eu
test "${R3_TARGET_CLASS:-}" = "owner-approved-isolated-restore"
test "${R3_PGPASS_SOURCE:-}" = "/run/secrets/pgpass"
cp "$R3_PGPASS_SOURCE" /run/secure/pgpass
chmod 0600 /run/secure/pgpass
export PGPASSFILE=/run/secure/pgpass
exec /usr/local/bin/supabase "$@" --db-url "postgresql://postgres@127.0.0.1:5432/r2_rehearsal?sslmode=disable"
'@ | Set-Content -LiteralPath (Join-Path $buildRoot "entrypoint.sh") -Encoding ascii
  docker build --pull=false --network none --tag $ImageTag $buildRoot
  if ($LASTEXITCODE -ne 0) { throw "R3 CLI sidecar build failed." }
  docker image inspect $ImageTag --format "{{.Id}}"
} finally {
  if (Test-Path -LiteralPath $buildRoot) {
    Remove-Item -LiteralPath $buildRoot -Recurse -Force
  }
}
