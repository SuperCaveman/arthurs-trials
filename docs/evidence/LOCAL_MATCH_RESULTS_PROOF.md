# Local authoritative match-results proof

Tested locally on 2026-08-12 against the real GameLift Servers Anywhere
development fleet. No managed game-server capacity was created.

## Flow exercised

1. A GameLift game session was created with server-only `matchId`,
   `participants`, and `xpAward` properties.
2. The dedicated server activated that session, scheduled a short test match,
   and published one immutable `match.completed` document to its configured
   local outbox.
3. The local results worker consumed the document, applied its XP award, and
   moved the file under the outbox `processed/` directory.
4. The GameLift session was then terminated through the normal callback; the
   dedicated-server process exited cleanly and no active local sessions
   remained.

The dedicated server, not a client, creates the completion event. The local
file outbox and in-memory rewards store are development stand-ins for the
planned SQS/DLQ and transactional RDS worker path.
