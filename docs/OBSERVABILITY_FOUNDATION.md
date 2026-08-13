# Operations observability foundation

Status: **Terraform template validated locally; not deployed**

The local HTML dashboard remains the evidence source for the working GameLift
Anywhere proof. This separate, default-off Terraform module defines the small
CloudWatch baseline for an approved managed results-worker demonstration.

## Signals and decisions

| Signal | Why it matters | Alarm boundary |
| --- | --- | --- |
| Oldest SQS message age | A successful match result is waiting too long for persistence. | Over 120 seconds for two one-minute periods. |
| DLQ visible messages | A result needs human recovery; silently retrying it is no longer enough. | Any visible message. |
| ECS worker CPU/memory | The worker cannot keep up or risks task failure. | 80% CPU or 85% memory for three one-minute periods. |
| RDS free storage | Reward persistence can fail if the small demo database fills. | Below 5 GiB. |

The dashboard visualizes the same queue, worker, and database metrics. Alarms
treat missing data as non-breaching because the service starts at desired count
zero; an empty worker should not page an operator.

## Security and cost posture

- The module is enabled only alongside the explicitly approved queue, database,
  and ECS worker runtime. It is absent from the normal zero-resource plan.
- Dashboard access follows the operator's AWS IAM permissions; it exposes no
  player credentials, GameLift session IDs, or event payloads.
- Alarm actions default to an empty list. The template neither creates SNS nor
  sends an external message unless an approved pre-existing action ARN is
  provided.
- A dashboard uses native CloudWatch metrics. The five optional alarms have a
  small per-alarm monthly charge if a managed demo enables them, so they belong
  only in a short, tagged window and should be removed with that demo.

## Production evolution

A production platform adds GameLift fleet/placement signals, ALB/API latency
and error rates, structured worker failure metrics, audit notifications, and
runbook-linked response playbooks. It should route alarms to a monitored team
destination and test one controlled failure per critical path. This template
does not claim those components are deployed.
