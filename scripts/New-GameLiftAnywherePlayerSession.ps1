[CmdletBinding()]
param(
    [string]$GameSessionId,
    [string]$PlayerId = "local-player-$([guid]::NewGuid().ToString('N'))"
)

$ErrorActionPreference = 'Stop'
$config = Import-PowerShellDataFile (Join-Path $PSScriptRoot 'GameLiftAnywhere.dev.psd1')

if ([string]::IsNullOrWhiteSpace($GameSessionId)) {
    $sessions = (aws gamelift describe-game-sessions `
        --region $config.Region `
        --fleet-id $config.FleetId `
        --location $config.LocationName `
        --status-filter ACTIVE `
        --output json | ConvertFrom-Json).GameSessions

    if (@($sessions).Count -ne 1) {
        throw 'Specify -GameSessionId when zero or more than one active session exists.'
    }

    $GameSessionId = $sessions[0].GameSessionId
}

$playerSession = aws gamelift create-player-session `
    --region $config.Region `
    --game-session-id $GameSessionId `
    --player-id $PlayerId `
    --output json | ConvertFrom-Json

[pscustomobject]@{
    GameSessionId   = $GameSessionId
    PlayerId        = $playerSession.PlayerSession.PlayerId
    PlayerSessionId = $playerSession.PlayerSession.PlayerSessionId
    Status          = $playerSession.PlayerSession.Status
    Address         = "$($playerSession.PlayerSession.IpAddress):$($playerSession.PlayerSession.Port)"
}
