# Local GameLift Anywhere runbook

Status: **safe to prepare now; execute after the player-session server binary is linked**

This runbook produces a small, reproducible evidence set for the portfolio
without deploying managed AWS infrastructure. It uses one headless local server
and one reduced-load client only.

## Safety preflight

1. Keep BIOS stability settings in their conservative state: A-XMP off, DDR4 at
   2133 MT/s, and PBO off.
2. Close Unreal Editor and any previous Arthur's Trials process.
3. Confirm at least 12 GB physical memory is free before launching the client.
4. Do not start a second client during this proof.
5. Do not use this runbook until the newly linked server includes
   `GameLiftRequirePlayerSession` support.

## 1. Start one Anywhere server

```powershell
./scripts/Start-GameLiftAnywhereLocal.ps1 -Port 7778
```

Expected log evidence:

- `Initializing GameLift for an Anywhere compute`
- `Init SDK success`
- `GameLift ProcessReady succeeded on port 7778`

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
& ./build/WindowsClient/ArthursTrials.exe "$($player.Address)?PlayerSessionId=$($player.PlayerSessionId)" -windowed -ResX=960 -ResY=540 -fps=30
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

## Evidence checklist

- Screenshot: GameLift Anywhere server `ProcessReady` and health state.
- Screenshot: one client connected to the dedicated server.
- Sanitized log: accepted player session and graceful shutdown.
- Screenshot or terminal output: game session `TERMINATED`.
- Short note: one local server, one client, one region, no managed EC2 capacity.
