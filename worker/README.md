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

## Container artifact

The worker has a small non-root local container image. It defaults to the
in-memory store, so building and running the image does not contact AWS or
create a queue/database. Standard output contains one JSON result record per
input event, which lets an automation consume the result without mixing it
with diagnostic logs:

```powershell
docker build -t arthurs-trials-results-worker:local .
'{"eventType":"match.completed","eventId":"17ea8ce7-6f3f-4b2a-9c93-5c3ed89f4691","matchId":"mrq_17ea8ce7-6f3f-4b2a-9c93-5c3ed89f4691","participants":["andrew"],"xpAward":125,"completedAt":"2026-08-13T15:00:00.000Z"}' |
  docker run --rm -i arthurs-trials-results-worker:local node src/worker.mjs
```

The future managed path will use this artifact pattern in ECR and a private
worker task. It will consume SQS through a least-privilege task role and write
to PostgreSQL transactionally; neither service is deployed by this package.

## Managed consumer entry point

`src/sqs-consumer.mjs` is the managed-only entry point used by the container
default. It long-polls one SQS message at a time, deletes it only after the
PostgreSQL receipt-and-XP transaction commits, and leaves rejected messages for
SQS retry/DLQ handling. It requires an IAM task role and these runtime values:

- `AWS_REGION`
- `RESULTS_QUEUE_URL`
- `RESULTS_DATABASE_SECRET_ARN`

The generated RDS secret is read at task startup and is never copied into the
task definition. Apply [`sql/001_match_results.sql`](sql/001_match_results.sql)
through an approved migration process before starting a worker task. The local
standard-input proof remains available by explicitly overriding the container
command with `node src/worker.mjs`.

## Test

```powershell
cd worker
npm test
```
