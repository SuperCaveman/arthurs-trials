[CmdletBinding()]
param(
    [string]$ApiBaseUrl = 'http://127.0.0.1:18081',
    [string]$PlayerId = 'andrew',
    [string]$ClientPath = 'D:\AWS Projects\ArthursTrials\build\WindowsClient\ArthursTrials.exe'
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $ClientPath)) {
    throw "Client executable not found: $ClientPath"
}

$headers = @{
    Authorization     = "Bearer local-dev-$PlayerId"
    'Idempotency-Key' = [guid]::NewGuid().ToString()
    'Content-Type'    = 'application/json'
}
$body = @{
    mode   = 'co-op-defense'
    region = 'us-east-1'
    party  = @($PlayerId)
} | ConvertTo-Json -Compress

# The API, not this test client, owns the GameLift calls. It returns only the
# connection details and short-lived player-session credential that Unreal needs.
$match = Invoke-RestMethod "$ApiBaseUrl/v1/matches" -Method Post -Headers $headers -Body $body

if ($match.status -ne 'READY' -or [string]::IsNullOrWhiteSpace($match.connection.playerSessionId)) {
    throw 'Session API did not return a ready connection credential.'
}

$arguments = @(
    "$($match.connection.address):$($match.connection.port)?PlayerSessionId=$($match.connection.playerSessionId)",
    '-windowed',
    '-ResX=960',
    '-ResY=540',
    '-fps=30'
)
$client = Start-Process -FilePath $ClientPath -ArgumentList $arguments -WorkingDirectory (Split-Path -Parent $ClientPath) -PassThru

[pscustomobject]@{
    HttpStatus                = 201
    MatchRequestId            = $match.matchRequestId
    MatchStatus               = $match.status
    ConnectionAddress         = $match.connection.address
    ConnectionPort            = $match.connection.port
    ClientProcessId           = $client.Id
    PlayerSessionIssuedByApi  = $true
    AwsCredentialsInClient    = $false
} | Format-List
