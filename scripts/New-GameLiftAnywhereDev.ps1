[CmdletBinding()]
param(
    [string]$Region = 'us-east-1',
    [string]$LocationName = 'custom-arthurs-trials-local',
    [string]$FleetName = 'ArthursTrials-dev-anywhere',
    [string]$ComputeName = 'andrew-pc-local'
)

$ErrorActionPreference = 'Stop'
$statePath = Join-Path $PSScriptRoot 'GameLiftAnywhere.dev.psd1'
$serverPath = 'D:\AWS Projects\ArthursTrials\build\WindowsServer-GameLift\ArthursTrials\Binaries\Win64\ArthursTrialsServer.exe'

$locations = (aws gamelift list-locations --region $Region --output json | ConvertFrom-Json).Locations
if ($locations.LocationName -notcontains $LocationName) {
    aws gamelift create-location --region $Region --location-name $LocationName `
        --tags Key=Project,Value=ArthursTrials Key=Environment,Value=dev Key=ManagedBy,Value=Codex | Out-Null
}

$fleet = aws gamelift create-fleet --region $Region --name $FleetName `
    --description 'Local GameLift Anywhere development fleet for Arthurs Trials' `
    --compute-type ANYWHERE --locations "Location=$LocationName" `
    --tags Key=Project,Value=ArthursTrials Key=Environment,Value=dev Key=ManagedBy,Value=Codex `
    --output json | ConvertFrom-Json

$fleetId = $fleet.FleetAttributes.FleetId
aws gamelift register-compute --region $Region --fleet-id $fleetId `
    --compute-name $ComputeName --ip-address 127.0.0.1 --location $LocationName | Out-Null

@"
@{
    Region       = '$Region'
    LocationName = '$LocationName'
    FleetId      = '$fleetId'
    ComputeName  = '$ComputeName'
    ServerPath   = '$serverPath'
}
"@ | Set-Content -LiteralPath $statePath -Encoding utf8

Write-Host "Created GameLift Anywhere fleet $fleetId and updated $statePath."
