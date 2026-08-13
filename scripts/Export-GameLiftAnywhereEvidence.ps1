[CmdletBinding()]
param(
    [string]$LogPath = 'D:\AWS Projects\ArthursTrials\build\WindowsServer-GameLift\ArthursTrials\Saved\Logs\ArthursTrials.log',
    [string[]]$AdditionalLogPaths = @(),
    [string]$OutputDirectory = 'D:\AWS Projects\ArthursTrials\logs\evidence'
)

$ErrorActionPreference = 'Stop'

$allLogPaths = @($LogPath) + @($AdditionalLogPaths)
foreach ($path in $allLogPaths) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Server log not found: $path"
    }
}

$patterns = @(
    'Initializing GameLift for an Anywhere compute',
    'Init SDK success',
    'GameLift ProcessReady succeeded',
    'Fault-injection mode enabled',
    'Fault injection: deliberately failed a GameLift health check',
    'Received Health Response: false',
    'Received Health Response: true',
    'OnStartGameSession',
    'ActivateGameSession',
    'GameLift accepted a player session',
    'Bound validated GameLift player session',
    'Rejected .*PlayerSessionId',
    'Released GameLift player session',
    'GameLift requested process termination',
    'ProcessEnding',
    'Destroy\(\)',
    'Exiting\.'
)

$combinedPattern = $patterns -join '|'
$excerpt = foreach ($path in $allLogPaths) {
    Get-Content -LiteralPath $path | Where-Object { $_ -match $combinedPattern }
}

if (@($excerpt).Count -eq 0) {
    throw 'No lifecycle evidence lines were found in the server log.'
}

$redacted = $excerpt |
    ForEach-Object {
        $_ -replace '\b\d{12}\b', '<aws-account-id>' `
           -replace 'fleet-[A-Za-z0-9-]+', '<fleet-id>' `
           -replace 'gsess-[A-Za-z0-9-]+', '<game-session-id>' `
           -replace 'psess-[A-Za-z0-9-]+', '<player-session-id>' `
           -replace '(?i)(authToken|glAnywhereAuthToken)=[^\s&]+', '$1=<redacted>'
    }

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$outputPath = Join-Path $OutputDirectory "gamelift-anywhere-evidence-$timestamp.txt"

@(
    '# Arthur''s Trials - sanitized GameLift Anywhere evidence',
    "# Source logs: $((@($allLogPaths | ForEach-Object { [IO.Path]::GetFileName($_) }) -join ', '))",
    "# Exported: $((Get-Date).ToUniversalTime().ToString('o'))",
    '',
    $redacted
) | Set-Content -LiteralPath $outputPath -Encoding utf8

Write-Host "Wrote sanitized evidence excerpt: $outputPath"

# This script can run immediately after an AWS CLI call that returned a nonzero
# status during an expected state transition. The export itself succeeded, so
# do not leak that stale native-process exit code to callers.
$global:LASTEXITCODE = 0
