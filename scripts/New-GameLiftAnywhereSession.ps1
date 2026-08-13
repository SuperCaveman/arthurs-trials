[CmdletBinding()]
param(
    [int]$Port = 7778,
    [int]$MaximumPlayerSessions = 4,
    [string]$MatchId,
    [string[]]$Participants = @(),
    [ValidateRange(0, 10000)]
    [int]$XpAward = 125
)

$ErrorActionPreference = 'Stop'
$config = Import-PowerShellDataFile (Join-Path $PSScriptRoot 'GameLiftAnywhere.dev.psd1')
$name = "arthurs-trials-local-$((Get-Date).ToUniversalTime().ToString('yyyyMMddHHmmss'))"

$gameProperties = @()
if (-not [string]::IsNullOrWhiteSpace($MatchId)) {
    if ($MatchId -notmatch '^mrq_[A-Za-z0-9-]+$') {
        throw 'MatchId must be an Arthur''s Trials match request identifier.'
    }
    if ($Participants.Count -lt 1 -or $Participants.Count -gt 4 -or
        @($Participants | Select-Object -Unique).Count -ne $Participants.Count -or
        @($Participants | Where-Object { $_ -notmatch '^[A-Za-z0-9._-]{3,64}$' }).Count -gt 0) {
        throw 'Participants must contain one to four distinct player identifiers.'
    }

    $gameProperties = @(
        "Key=matchId,Value=$MatchId",
        "Key=participants,Value=$($Participants -join ',')",
        "Key=xpAward,Value=$XpAward"
    )
}
elseif ($Participants.Count -gt 0) {
    throw 'Participants require MatchId so the server can publish an authoritative result event.'
}

$awsArguments = @(
    'gamelift', 'create-game-session',
    '--region', $config.Region,
    '--fleet-id', $config.FleetId,
    '--location', $config.LocationName,
    '--name', $name,
    '--maximum-player-session-count', $MaximumPlayerSessions
)
if ($gameProperties.Count -gt 0) {
    $awsArguments += '--game-properties'
    $awsArguments += $gameProperties
}
$awsArguments += '--output'
$awsArguments += 'json'

$session = aws @awsArguments | ConvertFrom-Json

[pscustomobject]@{
    GameSessionId = $session.GameSession.GameSessionId
    Status        = $session.GameSession.Status
    Address       = "$($session.GameSession.IpAddress):$($session.GameSession.Port)"
    MaximumPlayers = $session.GameSession.MaximumPlayerSessionCount
}
