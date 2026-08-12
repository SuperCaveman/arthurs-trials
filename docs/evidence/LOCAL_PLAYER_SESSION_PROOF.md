# Local GameLift player-session proof

Tested locally on 2026-08-10 against the real GameLift Servers Anywhere
development fleet. No managed game-server capacity was created.

## Positive admission

The client received a short-lived GameLift player-session credential from the
local helper, connected to the dedicated server, and GameLift marked the player
session `ACTIVE`.

The redacted server excerpt records both `AcceptPlayerSession` and the binding
of that credential to the connected player:

- [accepted player session](player-session-accepted.txt)

## Negative admission

A separate headless client attempted to join the active game session without a
`PlayerSessionId`. The server rejected it during Unreal's `PreLogin` stage, and
the client received `PreLoginFailure: A GameLift PlayerSessionId is required.`

- [rejected missing credential](player-session-rejected-without-credential.txt)

The excerpts redact AWS account, fleet, game-session, and player-session
identifiers. They are intentionally small evidence artifacts rather than a
substitute for source code or a production security review.
