# Local Session API to GameLift Anywhere proof

Tested locally on 2026-08-10 with one headless Unreal dedicated server on the
registered Anywhere workstation compute. No managed game-server capacity was
created.

## Flow exercised

1. The local Session API ran with `GAME_LIFT_ADAPTER=anywhere`.
2. A local development client sent `POST /v1/matches` with a bearer identity,
   party, and idempotency key.
3. The API created the GameLift game session, waited for it to become `ACTIVE`,
   created the caller's player session, and returned only the connection
   details plus its short-lived credential.
4. The Unreal client used that response to connect.
5. The dedicated server called `AcceptPlayerSession`, bound the credential to
   the player, and completed the join.

## Redacted artifacts

- [Session API events](session-api-anywhere-events.txt) record the API start
  and the `match_ready` event.
- [Server admission excerpt](session-api-anywhere-player-session-accepted.txt)
  records GameLift acceptance and binding of the player session.

The evidence does not contain AWS credentials, account identifiers, fleet IDs,
game-session IDs, or player-session IDs.
