# Match-results event contract

This contract describes the small local proof for the planned asynchronous
results path. It is not a deployed AWS service.

## Event

```json
{
  "eventType": "match.completed",
  "eventId": "17ea8ce7-6f3f-4b2a-9c93-5c3ed89f4691",
  "matchId": "mrq_17ea8ce7-6f3f-4b2a-9c93-5c3ed89f4691",
  "participants": ["andrew", "arthur"],
  "xpAward": 125,
  "completedAt": "2026-08-10T18:00:00.000Z"
}
```

The dedicated server is the authoritative local producer. It receives the
match request ID, party, and award through GameLift game-session properties and
publishes the event to a local file outbox only when its match-completion timer
fires. Clients do not submit completion events or determine rewards.

## Required behavior

- Only `match.completed` is accepted in the first contract.
- An event has a UUID-shaped `eventId`, one to four distinct participants, and
  an integer XP award from 0 through 10,000.
- A first delivery grants each participant the listed XP and records the event.
- A later delivery with the same `eventId` returns `DUPLICATE` and grants
  nothing further.
- Invalid events are rejected before any reward mutation.

## Local transport boundary

The file outbox is deliberately a narrow local substitute for SQS. The server
writes a complete JSON document to a temporary file and then moves it into the
outbox. The worker moves successfully handled events to `processed/` and bad
payloads to `rejected/`. It is useful for proving producer/consumer behavior,
but it is not durable, distributed, or a production queue.

The GameLift Anywhere adapter creates the game session with these server-only
properties:

- `matchId`
- `participants`
- `xpAward`

The public Session API response still returns only connection information and a
short-lived player-session credential. It does not expose an AWS credential or
give the client permission to create results.

## Planned managed implementation

SQS will provide at-least-once delivery; an ECS/Fargate worker will use a
transactional RDS/PostgreSQL write keyed by `eventId` to preserve the same
idempotency guarantee. Repeated failures will route to a DLQ for operator
inspection. Those AWS components are planned, not provisioned.
