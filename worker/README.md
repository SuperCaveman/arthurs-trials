# Local match-results worker

This is a dependency-free local contract for the planned asynchronous path:

```text
authoritative dedicated server → match.completed event → results worker → player rewards
```

It validates a small completion event, applies XP exactly once per `eventId`,
and reports replays as safe duplicates. The default in-memory store is only a
fast local proof. An opt-in file store atomically persists the reward mutation
and event receipt so a replay after one worker restart remains a duplicate; it
is still not a database.

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

## Restart-safe local proof

To persist the local receipt and player XP across a worker restart, use the
file adapter. Its state file belongs under the ignored `logs/` directory:

```powershell
$env:RESULTS_STORE = 'file'
$env:RESULTS_STORE_PATH = '..\logs\results-worker-store.json'
node src/outbox.mjs ..\game\ArthursTrials\Saved\MatchResultsOutbox
```

This adapter is deliberately restricted to one worker process. It has no
concurrent-writer protection, backup, encryption, cross-instance sharing, SQS,
or RDS. The code interface models the future transaction boundary: awarding all
participants and recording the event ID must succeed together or not at all.

## Test

```powershell
cd worker
npm test
```
