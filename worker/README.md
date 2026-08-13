# Local match-results worker

This is a dependency-free local contract for the planned asynchronous path:

```text
authoritative dedicated server → match.completed event → results worker → player rewards
```

It validates a small completion event, applies XP exactly once per `eventId`,
and reports replays as safe duplicates. The included in-memory store is only a
local proof: it is not durable and must not be presented as a database.

The future managed path will replace standard input with SQS delivery and the
store with a transactional RDS/PostgreSQL implementation plus a DLQ. No SQS,
RDS, or worker service is created by this local package.

## Local dedicated-server outbox

For the end-to-end local proof, the authoritative Unreal dedicated server
publishes immutable `match.completed` JSON files to its local outbox. Drain it
with the same idempotent worker logic:

```powershell
node src/outbox.mjs ../game/ArthursTrials/Saved/MatchResultsOutbox
```

Processed events move to `processed/`; invalid events move to `rejected/`.
This file outbox is a development stand-in for SQS, not a durable production
queue.

## Test

```powershell
cd worker
npm test
```
