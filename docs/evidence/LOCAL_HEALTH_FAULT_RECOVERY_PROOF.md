# Local GameLift health-fault and recovery proof

Tested locally on 2026-08-12 against the real GameLift Servers Anywhere
development fleet. No managed game-server capacity was created.

## Controlled failure

The Windows dedicated-server package was rebuilt with the bounded
`-FailHealthChecks` test switch. Started with `-FailHealthChecks 1`, the server
completed `InitSDK` and `ProcessReady`, deliberately returned one unhealthy
health callback, and GameLift issued `TerminateProcess` for that process.

This is the expected GameLift behavior. A server process that reports unhealthy
does not remain available merely to report a later successful callback.

## Recovery

A clean replacement server was started on the same registered Anywhere compute.
It completed `ProcessReady` and returned a healthy GameLift health response.
The replacement was then terminated through the normal GameLift game-session
lifecycle and exited cleanly.

Use the sanitized output produced by
`scripts/Export-GameLiftAnywhereEvidence.ps1` as the screen-recording/log
artifact. It redacts account, fleet, game-session, player-session, and token
values.
