[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateNotNullOrEmpty()]
    [string]$StagePath,

    [ValidatePattern('^[a-z0-9][a-z0-9._/-]*:[A-Za-z0-9._-]+$')]
    [string]$Tag = 'arthurs-trials-server:local'
)

$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$dockerfile = Join-Path $repositoryRoot 'containers\server\Dockerfile'
$resolvedStagePath = (Resolve-Path -LiteralPath $StagePath).Path
$serverBinary = Join-Path $resolvedStagePath 'ArthursTrials\Binaries\Linux\ArthursTrialsServer'

if (-not (Test-Path -LiteralPath $dockerfile -PathType Leaf)) {
    throw "Container recipe was not found: $dockerfile"
}

if (-not (Test-Path -LiteralPath $serverBinary -PathType Leaf)) {
    throw "StagePath must contain ArthursTrials\\Binaries\\Linux\\ArthursTrialsServer. Missing: $serverBinary"
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker is not available on PATH. Start Docker Desktop, then run this script again.'
}

Write-Host "Building local-only image '$Tag' from staged server path '$resolvedStagePath'."
& docker build --file $dockerfile --tag $Tag $resolvedStagePath
if ($LASTEXITCODE -ne 0) {
    throw "Docker build failed with exit code $LASTEXITCODE."
}

Write-Host "Built '$Tag'. No image was pushed and no AWS resource was changed."
