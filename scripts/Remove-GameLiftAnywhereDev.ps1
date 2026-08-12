[CmdletBinding(SupportsShouldProcess)]
param()

$ErrorActionPreference = 'Stop'
$config = Import-PowerShellDataFile (Join-Path $PSScriptRoot 'GameLiftAnywhere.dev.psd1')

if (-not $PSCmdlet.ShouldProcess($config.FleetId, 'Delete GameLift Anywhere fleet and local custom location')) {
    return
}

# Remove the compute first; this prevents an old local registration from being
# mistaken for a reusable test host after the fleet is rebuilt.
aws gamelift deregister-compute `
    --region $config.Region `
    --fleet-id $config.FleetId `
    --compute-name $config.ComputeName `
    --output json 2>$null

aws gamelift delete-fleet --region $config.Region --fleet-id $config.FleetId

do {
    Start-Sleep -Seconds 3
    $fleet = aws gamelift describe-fleet-attributes --region $config.Region --fleet-id $config.FleetId --output json 2>$null
} while ($LASTEXITCODE -eq 0 -and ($fleet | ConvertFrom-Json).FleetAttributes.Status -ne 'TERMINATED')

aws gamelift delete-location --region $config.Region --location-name $config.LocationName
Write-Host 'GameLift Anywhere development resources removed.'
