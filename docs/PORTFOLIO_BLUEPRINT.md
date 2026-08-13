# Arthur's Trials: AWS Multiplayer Platform blueprint

## North star

Make a small game feel like a serious cloud/platform project. The polished proof is a 2–4 player dedicated-server match; the material that makes it memorable is the evidence behind it: a production-style network and application tier, lifecycle correctness, security boundaries, API design, asynchronous processing, telemetry, capacity reasoning, failure recovery, automated delivery, and cost discipline.

This plan deliberately avoids an expensive always-on fleet and avoids pretending that a four-player demo has proven internet-scale load.

## Capability matrix

| Capability cloud/platform teams value | Arthur's Trials evidence | Cost-aware implementation |
| --- | --- | --- |
| Production network and application architecture | Two-AZ VPC, public ALB, private ECS/Fargate services, private database, security groups and route tables | Build and validate all Terraform locally; deploy the expensive network/app stack only in a scheduled demo window and destroy it afterwards. |
| Dedicated server lifecycle | Server SDK v5 integration: `InitSDK`, `ProcessReady`, `OnStartGameSession`, `ActivateGameSession`, `OnHealthCheck`, `OnProcessTerminate`, `ProcessEnding`, `Destroy` | Run against a local Anywhere compute; unit-test game-state transitions where practical. |
| Authoritative join flow | A private ECS/Fargate session API creates placement/player sessions; server validates player-session IDs and removes disconnected players | Cognito authenticates the client. Never embed AWS credentials in the client. |
| Durable asynchronous workflow | Server emits a completed-match event; SQS triggers an idempotent Fargate results worker; failures eventually reach a DLQ | Exercise the contract locally; create the AWS resources only in opt-in cloud mode. |
| Data design | RDS PostgreSQL stores player profiles, session state, match results and result idempotency keys | Use a uniqueness constraint and transaction to prevent a replayed event from awarding XP twice. |
| Local-to-cloud parity | Same server build and runtime configuration exercised locally, containerized for managed-cloud deployment | GameLift Servers Anywhere first; Docker build and image scan locally. |
| Container delivery | Linux dedicated server is packaged as a versioned image, stored in ECR, and referenced by a GameLift managed-container definition | Build the image locally; ECR push and fleet update are manual, time-boxed cloud-demo steps. |
| Matchmaking | A small FlexMatch 4-player co-op rule set: party size, skill band, latency preference, progressive relaxation | Validate and document the rule set; run only a small scheduled cloud test if needed. |
| Session placement | Queue configuration uses latency information, capacity, and cost ordering | A single-region implementation is sufficient for the demo; multi-region queue configuration stays parameterized and disabled. |
| Scaling | Capacity model records server CPU/memory/tick budget, sessions per host, buffer target, and scale-out latency | Run measured local soak tests; use target-based autoscaling only during an on-demand managed demonstration. |
| Reliability | Health checks cover engine responsiveness and a dependency check; match completion and termination flush state cleanly | Fault-injection test: force an unhealthy health check and demonstrate recovery locally. |
| Observability | Dashboard and alarms for ALB targets/latency/5xx, ECS CPU/memory/task count, RDS health, availability, abnormal exits, placement wait/failure, queue age, DLQ depth, and app errors; correlation ID through placement/session/logs | CloudWatch dashboard as IaC; keep high-cardinality telemetry and managed Grafana/Prometheus out of the baseline. |
| Delivery safety | GitHub Actions builds/test package, `terraform fmt`/validate/plan, policy checks; AWS access through OIDC | No long-lived AWS keys in GitHub. Managed apply needs manual approval and an explicit cost flag. |
| Security | Least-privilege runtime role, encrypted data, secrets out of source control, audit trail, restrictive network rules | IAM policy tests and static IaC scanning; do not add WAF, Shield Advanced, or NAT gateways to the baseline. |
| FinOps | Cost tags, budget alert, deploy/destroy checklists, cost estimates noted with every demo | Managed resources default to off; `destroy` runbook and evidence are portfolio assets. |

## Direct alignment with the transcripts

The project deliberately turns the recurring advice in the four videos into one coherent system:

| Transcript theme | Arthur's Trials implementation |
| --- | --- |
| Production architecture | VPC across two availability zones, public ALB, private containers, private RDS, security groups, autoscaling and CloudWatch. |
| Terraform as the source of truth | Parameterized modules, remote state, `fmt`/`validate`/`plan`, and repeatable development/demo environments. |
| Containers and ECR | The API, results worker, and Linux dedicated-server workload are built as Docker images and versioned in ECR. |
| Safe CI/CD | A GitHub-triggered pipeline runs application tests and Terraform checks, then requires explicit approval before a cloud release. ECS health checks protect application releases; GameLift releases use a new immutable container/fleet definition and controlled queue cutover. |
| Monitoring and alerting | CloudWatch dashboards, alarms and SNS notifications reveal actionable failures instead of requiring manual polling. |
| One system with value | The business problem is safe, repeatable game-server releases and session operations for a small studio without a 24/7 platform team. We measure deployment time, session-placement latency, recovery time, throughput, and real demo cost; we do not invent a savings claim. |
| Documentation and visibility | README, architecture diagram, key decisions, reproduction runbook, failure postmortem, benchmark report, and incremental LinkedIn posts. |

## Implementation sequence

### 1. The playable proof

Build the smallest fun loop: a 10–15 minute four-player cooperative village defense with join, match start, completion, XP reward, and server shutdown. No open world, persistent combat service, cosmetic store, or player-facing social system.

**Done means:** one server and multiple local clients complete a match; the server remains authoritative for match outcome and rewards.

### 2. Correct GameLift Servers integration

Use the Unreal GameLift Servers plugin and Server SDK v5. Implement the full lifecycle rather than a superficial `ProcessReady` demo:

1. Start a server process with unique Anywhere parameters.
2. Call `InitSDK` and `ProcessReady` only after the server is actually ready.
3. On `OnStartGameSession`, load the match and call `ActivateGameSession` only when players can join.
4. Validate every player-session ID before admitting a client.
5. On disconnect, call `RemovePlayerSession` so the slot is accurately released.
6. On match end or `OnProcessTerminate`, stop admissions, persist the final reward once, notify players, call `ProcessEnding`, then `Destroy`.
7. Make the health check fail for a real, explainable reason (for example, the match-state executor stops responding), verify that GameLift terminates the unhealthy process, then verify a replacement process returns healthy.

**Evidence:** a short capture of a placement, connections, a graceful termination, and a controlled unhealthy-server recovery; server logs with placement and game-session IDs redacted as appropriate.

### 3. Production-style control plane and data

The client authenticates with Cognito and calls a session API running on ECS/Fargate behind an Application Load Balancer. That backend, not the client, is allowed to call GameLift Servers placement/session APIs. It returns only connection details and a player-session ID. The API and database live in private subnets; only the ALB is internet-facing.

At match completion, the server sends a small immutable result event to SQS. A Fargate worker applies the player progression update to RDS in a transaction using a match-and-player idempotency key. Retryable errors return to the queue; poison messages eventually reach a DLQ for inspection. This is an intentional platform pattern, not an extra AWS service added for its own sake: game servers must not lose or double-apply results when an external dependency is transiently unavailable.

**Important decisions to document:**

- Trust boundary: the client may request a match, but the dedicated server decides match results.
- No AWS access key or broad GameLift permission ships in the Unreal client.
- Dedicated-server access is through a narrowly scoped runtime role; player progression updates are owned by the results worker rather than the client.
- The RDS database is not publicly reachable. Application and worker roles receive only the permissions and database credentials they need.
- CloudTrail audits control-plane calls; session/server logs are retained for a short, documented period.

### 4. Infrastructure and delivery

Terraform manages the optional AWS resources. The normal pipeline performs formatting, validation, linting/scanning, Unreal/server build checks where feasible, and a Terraform plan. A protected manual workflow performs the cloud demo and requires `ALLOW_MANAGED_DEMO=true`.

GitHub Actions uses AWS OIDC with a scoped deployment role. It does not contain static AWS credentials. Every change runs tests, Docker builds, `terraform fmt`, `terraform validate`, and `terraform plan`. A protected environment approval is required before an apply or image release.

**Required repository artifacts:**

- Terraform modules and environment variables that default to no managed fleet or costly always-on application tier.
- Modules for network, identity, ALB/ECS application, RDS data, asynchronous results, ECR/container delivery, GameLift hosting, CloudWatch/SNS monitoring, and shared security configuration.
- Remote Terraform state and locking, with documented access controls and recovery procedures.
- A generated or checked-in architecture diagram.
- A release/build manifest recording Unreal, GameLift Server SDK, container, and Terraform versions.
- `RUNBOOK.md`: deploy, smoke test, observe, terminate, destroy, and confirm costs.
- `DECISIONS.md`: why managed containers are the deployment target, why Anywhere is the development target, and why FlexMatch is optional in the first demo.

### 5. Operations demo

Provision a CloudWatch dashboard and alarms with Terraform. The baseline dashboard should show:

- `AvailableGameSessions` and `ActiveServerProcesses` (capacity);
- `PercentHealthyServerProcesses` and `ServerProcessAbnormalTerminations` (health);
- `AverageWaitTime`, `QueueDepth`, and placement failures (player experience);
- ALB requests/latency/5xx, ECS task/CPU/memory health, RDS health, SQS age, and DLQ depth (control plane);
- a custom `MatchCompleted` or `RewardPersistFailure` application signal.

For a later container demonstration, include server tick rate/time, CPU, memory, packet loss, and connection count. Do not add managed Prometheus and Grafana until there is a reason and budget; CloudWatch is enough for this portfolio baseline.

### 6. Scale case study

Document three honest stages:

| Stage | What is actually present | How it scales |
| --- | --- | --- |
| Local proof | One Anywhere compute, 2–4 players, one region | Repeatable local processes; measured resource budget per match. |
| On-demand cloud proof | One managed hosting location, short-lived capacity, a queue, alarms | Target-based autoscaling maintains a small buffer of available sessions. |
| Production design | Multi-location queue, regional fleet configuration, matchmaker per game mode/region, rollback and evacuation runbooks | Player latency guides placement; capacity limits, warm buffers, scheduled scaling, and regional failover handle demand/failure. |

The production design may discuss Spot/FleetIQ or mixed capacity, but it must explicitly cover interruption handling: stop new placement on draining capacity, let eligible matches finish or reconnect, and retain a reliable fallback. It is a design exercise, not an unearned production claim. Scale-to/from-zero is a cost-saving option for the on-demand environment, and its first-session cold-start delay must be measured and documented rather than hidden.

## Design choices that signal maturity

### Managed containers as the cloud target

The public architecture should target a Linux container image in ECR and a GameLift Servers managed container fleet. It demonstrates portable builds, immutable artifact versioning, and a current hosting model. The first working cloud proof may use managed EC2 if it is materially easier, but the README must accurately state which route was used.

### FlexMatch: compelling, but not the first dependency

Keep a compact, version-controlled FlexMatch rule set in the repository. It should match a cooperative party of up to four and progressively widen the permitted skill spread as wait time increases. Make it optional in the live demo so it cannot block the core game-session proof. Add automatic backfill only after player disconnect behavior is stable.

### Load testing with credibility

Do not fake 100,000 concurrent players. Write a lightweight placement/load simulator that can:

- create a configurable number of synthetic placement requests against a test environment;
- record placement success, wait time, server admission, and completion;
- preserve an upper concurrency cap and dry-run mode;
- produce a small CSV/chart used in the case study.

State the tested load, instance/server specification, and test limitations beside every graph.

### Resilience experiment

Perform and record one controlled failure per category:

- server health failure and replacement;
- graceful session termination after a completed match;
- unhealthy ECS application deployment that fails its health check and is rolled back;
- transient results-worker failure with an idempotent reward retry, plus a poison message reaching the DLQ;
- placement rejection when capacity is exhausted, with a player-safe response.

This is more compelling than adding a second region before the core system is correct.

## Cost guardrails

1. **Default mode is local.** Anywhere runs on the development workstation; no EC2 is needed for routine work.
2. **Cloud mode is opt-in.** Terraform must require both an environment and a boolean confirmation to create a managed fleet or other billable hosting capacity.
3. **One scheduled demo window.** Start with one region, the smallest suitable Linux capacity, a documented timebox, and destroy immediately after evidence is captured.
4. **No accidental network bill.** The multi-AZ/VPC/ALB/RDS architecture is an explicit, short-lived demonstration, not a permanently running hobby stack. Avoid multi-region replication, managed Prometheus/Grafana, and always-on APIs until the portfolio benefit justifies the cost.
5. **Budget before hosting.** Use a low AWS Budget alert and resource tags including `project=arthurs-trials`, `environment`, `owner`, and `expires-at`.
6. **Teardown is verified.** The runbook ends with Terraform destroy, GameLift resource checks, and a cost-console review the following day.

The GameLift Servers Anywhere free tier is useful but not assumed: it is currently limited to the first 12 months of account eligibility. Check current AWS pricing before every cloud test.

## Public-facing deliverables

- 60–90 second LinkedIn video: players join a match, show placement/session flow, dashboard, controlled failure, and teardown.
- 8–12 minute technical walkthrough: business problem, architecture, code lifecycle, Terraform, security boundary, asynchronous results workflow, metrics, capacity model, tradeoffs.
- A clean GitHub README with one architecture image, an implementation-status table, a cost section, and exact reproduction instructions.
- One written case study: “How I designed a multiplayer platform to scale without paying for scale during development.”
- A diagram and one small results graphic, each clearly annotated with the test environment.

## Sources used for this blueprint

- [GameLift Servers Anywhere for local testing](https://docs.aws.amazon.com/gameliftservers/latest/developerguide/integration-testing.html)
- [Unreal Engine plugin and local Anywhere workflow](https://docs.aws.amazon.com/gameliftservers/latest/developerguide/unreal-plugin.html)
- [Server SDK lifecycle and health checks](https://docs.aws.amazon.com/gameliftservers/latest/developerguide/gamelift-sdk-server-api.html)
- [Managed container fleets and ECR container groups](https://docs.aws.amazon.com/gameliftservers/latest/developerguide/containers-create-groups.html)
- [Game client/server interaction and player-session lifecycle](https://docs.aws.amazon.com/gameliftservers/latest/developerguide/gamelift-sdk-interactions.html)
- [Queues and placement strategy](https://docs.aws.amazon.com/gameliftservers/latest/developerguide/queues-intro.html)
- [Capacity scaling](https://docs.aws.amazon.com/gameliftservers/latest/developerguide/fleets-manage-capacity.html)
- [Scale a fleet to and from zero](https://docs.aws.amazon.com/gameliftservers/latest/developerguide/fleets_scale-to-from-zero.html)
- [CloudWatch and telemetry metrics](https://docs.aws.amazon.com/gameliftservers/latest/developerguide/monitoring-cloudwatch.html)
- [FlexMatch overview](https://docs.aws.amazon.com/gameliftservers/latest/developerguide/gamelift-match-intro.html)
- [AWS Well-Architected Games Industry Lens](https://docs.aws.amazon.com/wellarchitected/latest/games-industry-lens/games-industry-lens.html)
- [GameLift Servers Anywhere pricing](https://aws.amazon.com/gamelift/servers/pricing/anywhere-pricing/)
