[CmdletBinding()]
param(
    [int]$Port = 7778,
    [string]$ProcessId = "arthurs-trials-anywhere-$([guid]::NewGuid().ToString('N'))",
    [switch]$DisablePlayerSessionValidation,
    [ValidateRange(0, 10)]
    [int]$FailHealthChecks = 0
)

$ErrorActionPreference = 'Stop'
$config = Import-PowerShellDataFile (Join-Path $PSScriptRoot 'GameLiftAnywhere.dev.psd1')

if (-not (Test-Path -LiteralPath $config.ServerPath)) {
    throw "Staged server not found: $($config.ServerPath)"
}

# The auth token is short-lived and intentionally remains only in this process
# and the server command line. Do not save it in a file or commit it to Git.
$authToken = (aws gamelift get-compute-auth-token `
    --region $config.Region `
    --fleet-id $config.FleetId `
    --compute-name $config.ComputeName `
    --output json | ConvertFrom-Json).AuthToken

if ([string]::IsNullOrWhiteSpace($authToken)) {
    throw 'GameLift did not return a compute authentication token.'
}

$arguments = @(
    'ArthursTrials',
    "/Game/ThirdPerson/Lvl_ThirdPerson?listen?Port=$Port",
    "-Port=$Port",
    '-nullrhi',
    '-stdout',
    '-FullStdOutLogOutput',
    '-unattended',
    '-GameLiftEnabled',
    '-glAnywhere',
    "-glAnywhereWebSocketUrl=wss://$($config.Region).api.amazongamelift.com",
    "-glAnywhereFleetId=$($config.FleetId)",
    "-glAnywhereProcessId=$ProcessId",
    "-glAnywhereHostId=$($config.ComputeName)",
    "-glAnywhereAuthToken=$authToken",
    "-glAnywhereAwsRegion=$($config.Region)"
)

if (-not $DisablePlayerSessionValidation) {
    $arguments += '-GameLiftRequirePlayerSession'
}

if ($FailHealthChecks -gt 0) {
    # This is intentionally explicit and bounded: it provides repeatable
    # failure-recovery evidence without changing normal local-server behavior.
    $arguments += "-GameLiftFailHealthChecks=$FailHealthChecks"
}

$server = Start-Process `
    -FilePath $config.ServerPath `
    -ArgumentList $arguments `
    -WorkingDirectory (Split-Path -Parent $config.ServerPath) `
    -PassThru

Write-Host "Started GameLift Anywhere server PID $($server.Id) on 127.0.0.1:$Port."
Write-Host 'Use Stop-GameLiftAnywhereSession.ps1 to request a graceful GameLift shutdown.'
