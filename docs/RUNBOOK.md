# Local GameLift Anywhere runbook

Status: **verified local GameLift Anywhere flow; use conservative workstation settings**

This runbook produces a small, reproducible evidence set for the portfolio
without deploying managed AWS infrastructure. It uses one headless local server
and one reduced-load client only.

## Safety preflight

1. Keep BIOS stability settings in their conservative state: A-XMP off, DDR4 at
   2133 MT/s, and PBO off.
2. Close Unreal Editor and any previous Arthur's Trials process.
3. Confirm at least 12 GB physical memory is free before launching the client.
4. Do not start a second client during this proof.
5. Keep player-session credentials and Anywhere auth tokens out of screenshots
   and logs intended for the public portfolio.

## 1. Start one Anywhere server

```powershell
./scripts/Start-GameLiftAnywhereLocal.ps1 -Port 7778
```

Expected log evidence:

- `Initializing GameLift for an Anywhere compute`
- `Init SDK success`
- `GameLift ProcessReady succeeded on port 7778`

### Optional reliability proof: bounded health-check failure

For a controlled failure/recovery capture, start the server this way instead:

```powershell
./scripts/Start-GameLiftAnywhereLocal.ps1 -Port 7778 -FailHealthChecks 1
```

This explicit test-only switch makes the next health-check callback return
unhealthy once. GameLift treats that as an unhealthy process and issues
`TerminateProcess`, so do not expect that same process to report healthy later.
For the recovery half of the test, start a fresh replacement server without the
switch and verify its `ProcessReady` and `Received Health Response: true` log
lines. Do not use this switch during the normal playable capture.

## 2. Create a game session

```powershell
$session = ./scripts/New-GameLiftAnywhereSession.ps1
$session
```

Wait until the server log contains `ActivateGameSession`.

## 3. Create a player session

```powershell
$player = ./scripts/New-GameLiftAnywherePlayerSession.ps1 -GameSessionId $session.GameSessionId
$player
```

Keep the `PlayerSessionId` private. It is a join credential and must not appear
in public screenshots or repository files.

## 4. Run one constrained client

```powershell
& ./build/WindowsClient/ArthursTrials/Binaries/Win64/ArthursTrialsClient.exe "$($player.Address)?PlayerSessionId=$($player.PlayerSessionId)" -windowed -ResX=960 -ResY=540 -fps=30
```

Expected server log evidence:

- `GameLift accepted a player session`
- `Bound validated GameLift player session`

For the negative proof, stop the valid client, create a fresh game session, and
attempt a connection with no `PlayerSessionId`. The server should reject it with
`A GameLift PlayerSessionId is required.` Do not reuse a player-session
credential after it has been accepted.

## 5. End cleanly

```powershell
./scripts/Stop-GameLiftAnywhereSession.ps1
```

Expected evidence:

- `GameLift requested process termination`
- `ProcessEnding`
- `Destroy`
- the game session reports `TERMINATED`

## 6. Export a safe log excerpt

```powershell
./scripts/Export-GameLiftAnywhereEvidence.ps1
```

The exporter filters the lifecycle lines and redacts AWS account IDs, game
session IDs, player session IDs, and auth-token values before writing an
evidence text file under `logs/evidence/`.

## Optional: authoritative match-results proof

This local proof uses a file outbox in place of the planned SQS queue. It does
not create SQS, RDS, ECS, or managed game-server capacity.

1. Start the dedicated server with an explicit short completion delay and an
   outbox folder:

```powershell
$outbox = Join-Path (Resolve-Path ./logs) 'match-results-outbox-demo'
./scripts/Start-GameLiftAnywhereLocal.ps1 `
  -MatchResultsCompleteAfterSeconds 20 `
  -MatchResultsOutboxDir $outbox
```

2. Create the GameLift session with server-only match metadata:

```powershell
$matchId = "mrq_$([guid]::NewGuid())"
./scripts/New-GameLiftAnywhereSession.ps1 `
  -MatchId $matchId `
  -Participants @('andrew') `
  -XpAward 125
```

3. After the server logs `Authoritative match-completion event published`, run
the durable local worker. The store records the reward and event receipt
together, so retain the same path if you restart the worker:

```powershell
$env:RESULTS_STORE = 'file'
$env:RESULTS_STORE_PATH = Join-Path (Resolve-Path ./logs) 'match-results-worker-state.json'
node ./worker/src/outbox.mjs $outbox
```

Expected proof: one `PROCESSED` result, an event file moved under
`$outbox/processed/`, and no client ability to submit a result. To demonstrate
at-least-once safety, copy the processed JSON back to `$outbox` with a distinct
filename and run the same command again. It should return `DUPLICATE`; the
existing reward receipt stays unchanged. End the local session with
`Stop-GameLiftAnywhereSession.ps1` as usual.

### Recording moment

Start recording immediately before creating the game session. Capture: the
server lifecycle reaching `ProcessReady`, the terminal's first `PROCESSED`
result, the second `DUPLICATE` result after the worker restart/replay, then the
graceful termination. Do not show the raw server command line, game-session ID,
or player-session credentials.

## Evidence checklist

- Screenshot: GameLift Anywhere server `ProcessReady` and health state.
- Screenshot: one client connected to the dedicated server.
- Sanitized log: accepted player session and graceful shutdown.
- Screenshot or terminal output: game session `TERMINATED`.
- Short note: one local server, one client, one region, no managed EC2 capacity.
