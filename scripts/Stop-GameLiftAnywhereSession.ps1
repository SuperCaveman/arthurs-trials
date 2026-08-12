[CmdletBinding()]
param(
    [string]$GameSessionId
)

$ErrorActionPreference = 'Stop'
$config = Import-PowerShellDataFile (Join-Path $PSScriptRoot 'GameLiftAnywhere.dev.psd1')

if ([string]::IsNullOrWhiteSpace($GameSessionId)) {
    $sessions = (aws gamelift describe-game-sessions `
        --region $config.Region `
        --fleet-id $config.FleetId `
        --status-filter ACTIVE `
        --output json | ConvertFrom-Json).GameSessions

    if (@($sessions).Count -ne 1) {
        throw 'Specify -GameSessionId when zero or more than one active session exists.'
    }

    $GameSessionId = $sessions[0].GameSessionId
}

aws gamelift terminate-game-session `
    --region $config.Region `
    --game-session-id $GameSessionId `
    --termination-mode TRIGGER_ON_PROCESS_TERMINATE `
    --output json

Write-Host 'Graceful termination requested. The GameLift callback will stop the server process.'
