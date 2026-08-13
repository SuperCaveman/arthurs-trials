# Asynchronous results foundation

Status: **Terraform/runtime template validated locally; not deployed**

The local GameLift proof already shows the important behavior: the authoritative
server emits an immutable `match.completed` event, and the worker applies its
reward exactly once—even if the same event is replayed after a worker restart.
The optional Terraform module maps that proven boundary to a managed SQS
transport and dead-letter queue (DLQ).

## What the future managed slice creates

| Component | Problem solved | Guardrail |
| --- | --- | --- |
| Match-results SQS queue | Decouples a game server's completion event from worker availability and permits at-least-once delivery. | AWS-managed server-side encryption, a 60-second visibility timeout, and four-day retention. |
| DLQ | Keeps repeatedly failing/invalid messages from blocking normal rewards. | A message moves after five failed receives and remains available for 14 days for operator recovery. |
| Transactional worker contract | Prevents duplicate XP when SQS re-delivers an event. | The eventual worker must write the event receipt and every player's reward in one PostgreSQL transaction keyed by `eventId`. |

## Security and cost choices

- No client can send a completion event directly. The dedicated server is the
  producer, and a future task role will receive only `sqs:SendMessage` for the
  results queue.
- A future worker role receives only consume/delete permissions for that queue
  plus the narrowly scoped database credentials it needs. It does not need
  GameLift placement access.
- Queues use AWS-managed encryption rather than an extra customer-managed KMS
  key for this small portfolio demonstration. A production environment may
  require customer-managed keys and formal key-policy separation.
- SQS has no idle-server cost, but requests and retained data can incur small
  charges. The module is still disabled by default and inherits the explicit
  managed-demo consent/expiry gate.
- The opt-in ECS worker is a private-subnet Fargate service with no inbound
  security-group rules, desired count zero, a 14-day log group, and a task role
  restricted to consuming this queue and reading its database secret. It does
  not receive GameLift placement or client-authentication permissions.
- A private task needs egress to pull an image and reach SQS, Secrets Manager,
  and CloudWatch Logs. This template deliberately creates neither NAT nor VPC
  endpoints: both add recurring cost. An approved live run must choose and
  document one of those paths before raising worker desired count above zero.

## Failure and recovery flow

```text
Unreal dedicated server
  -> immutable match.completed event
  -> SQS match-results queue
  -> idempotent results worker + PostgreSQL transaction
  -> success: delete message
  -> repeated failure: DLQ after five receives
  -> operator fixes/replays with the original eventId
  -> receipt makes replay a safe duplicate
```

The local file outbox is not SQS, and the file store is not PostgreSQL. They
are deliberately named local proofs rather than cloud deployments. See the
[match-results contract](MATCH_RESULTS_CONTRACT.md) for the tested behavior.

## Safe validation

`infra/` remains in `local` mode by default, so `terraform plan` contains zero
resource changes. Setting `enable_async_results=true` without the explicit
managed-demo mode and expiry fails the Terraform gate; do not apply without a
separate, time-boxed cost approval.

The optional runtime also requires `enable_database=true`,
`enable_results_worker_runtime=true`, and an immutable
`results_worker_image_uri`. Its desired count defaults to zero. The container's
SQS consumer and SQL migration are source-tested locally; no queue, database,
ECS cluster, task, service, image registry, or Fargate task was created.
