[CmdletBinding()]
param(
    [int]$Port = 7778,
    [int]$MaximumPlayerSessions = 4
)

$ErrorActionPreference = 'Stop'
$config = Import-PowerShellDataFile (Join-Path $PSScriptRoot 'GameLiftAnywhere.dev.psd1')
$name = "arthurs-trials-local-$((Get-Date).ToUniversalTime().ToString('yyyyMMddHHmmss'))"

$session = aws gamelift create-game-session `
    --region $config.Region `
    --fleet-id $config.FleetId `
    --location $config.LocationName `
    --name $name `
    --maximum-player-session-count $MaximumPlayerSessions `
    --output json | ConvertFrom-Json

[pscustomobject]@{
    GameSessionId = $session.GameSession.GameSessionId
    Status        = $session.GameSession.Status
    Address       = "$($session.GameSession.IpAddress):$($session.GameSession.Port)"
    MaximumPlayers = $session.GameSession.MaximumPlayerSessionCount
}
