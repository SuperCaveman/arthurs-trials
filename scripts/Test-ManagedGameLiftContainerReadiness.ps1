[CmdletBinding()]
param(
    [string]$ImageTag = 'arthurs-trials-server:local',

    [string]$StagePath = 'H:\ArthursTrials-LinuxPackage\Archive\LinuxServer',

    [ValidateRange(1, 65535)]
    [int]$RequiredPort = 7777
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker is not available on PATH. Start Docker Desktop before running this local readiness check.'
}

$serverBinary = Join-Path $StagePath 'ArthursTrials\Binaries\Linux\ArthursTrialsServer'
if (-not (Test-Path -LiteralPath $serverBinary -PathType Leaf)) {
    throw "The staged Linux server is missing: $serverBinary"
}

$inspect = (& docker image inspect $ImageTag --format '{{json .}}' | ConvertFrom-Json)
if ($inspect.Architecture -ne 'amd64' -or $inspect.Os -ne 'linux') {
    throw "Expected a linux/amd64 server image; found $($inspect.Os)/$($inspect.Architecture)."
}

if ($inspect.Config.User -ne 'arthurs') {
    throw "Expected the non-root container user 'arthurs'; found '$($inspect.Config.User)'."
}

$portKey = "$RequiredPort/udp"
if (-not $inspect.Config.ExposedPorts.PSObject.Properties.Name.Contains($portKey)) {
    throw "Expected the image to expose UDP $RequiredPort."
}

[pscustomobject]@{
    event                = 'managed_gamelift_container_readiness_verified'
    image                = $ImageTag
    architecture         = "$($inspect.Os)/$($inspect.Architecture)"
    nonRootUser          = $inspect.Config.User
    udpPort              = $RequiredPort
    stagedServerPresent  = $true
    imageSizeMegabytes   = [math]::Round($inspect.Size / 1MB, 1)
    awsResourcesCreated  = $false
    nextApprovalRequired = 'ECR push and managed GameLift fleet creation'
} | ConvertTo-Json -Compress
