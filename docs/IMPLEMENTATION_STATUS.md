# Implementation status and evidence

This document separates the working Arthur's Trials proof from the planned
production architecture. It is intentionally conservative: a planned component
is never described as deployed or tested.

Last reviewed: 2026-08-13

| Capability | Status | Evidence | Next proof |
| --- | --- | --- | --- |
| Unreal dedicated server | **Working locally** | A Win64 dedicated server runs headlessly and accepts a local client on the Third Person map. | Repeat the local test after each server change. |
| GameLift Servers Anywhere lifecycle | **Working locally** | The server has completed `InitSDK`, `ProcessReady`, health checks, game-session activation, and graceful `ProcessEnding`/`Destroy` against the real Anywhere fleet. | Capture a short, redacted lifecycle video and server-log excerpt. |
| GameLift health fault injection | **Verified locally** | The Anywhere launcher can opt in to one bounded failed health check with `-FailHealthChecks`. GameLift issued `TerminateProcess` for the unhealthy process; a clean replacement process then completed `ProcessReady` and returned healthy. It is disabled by default and guarded by a static CI contract test. | Repeat the controlled failure and replacement-process recovery test after lifecycle changes. |
| Game-session lifecycle | **Working locally** | The helper scripts create an Anywhere game session and terminate it through the GameLift termination callback. | Document session identifiers only in redacted evidence. |
| FlexMatch matchmaking | **Rule-set template validated locally; not deployed** | A versioned two-to-four player co-op FlexMatch template encodes party-safe latency limits, timed relaxation, and backfill preference. It is JSON/static-contract validated only; no matchmaker, queue, fleet, or ticket exists. See the [design](FLEXMATCH_DESIGN.md). | Submit real latency-aware tickets through the authenticated session API during an explicitly approved managed demo. |
| Player-session admission | **Verified locally** | The linked dedicated server accepted a real GameLift `PlayerSessionId` with `AcceptPlayerSession`, bound it to the player, and rejected a separate client without a credential during `PreLogin`. See [redacted proof](evidence/LOCAL_PLAYER_SESSION_PROOF.md). | Replace the local helper with the planned authenticated session API. |
| Client credential boundary | **Verified locally** | `New-GameLiftAnywherePlayerSession.ps1` returned only connection details plus a short-lived player-session credential; the Unreal client received no AWS credentials. See [redacted proof](evidence/LOCAL_PLAYER_SESSION_PROOF.md). | Replace the local helper with the planned authenticated session API. |
| Player authentication | **Cognito-compatible verifier tested locally; not deployed** | The opt-in Cognito user-pool/public-client Terraform module creates nothing in the zero-resource default plan. The session API now verifies locally generated Cognito-shaped RS256 access tokens against an injected JWKS, including issuer/client/token-use/expiry/signature checks; local bearer authentication remains development-only. No live user pool or sign-in was used. See the [security/delivery foundation](SECURITY_DELIVERY_FOUNDATION.md). | Run an explicitly approved live Cognito sign-in and verify a client cannot request another player's session. |
| Session API | **Verified locally; not deployed** | A dependency-free Node HTTP API enforces a local caller boundary, party ownership, idempotency, owner-only reads, and returns only connection details plus a player-session credential. Its Anywhere adapter created a real local GameLift session and credential that the dedicated server accepted. It maps GameLift capacity exhaustion to a player-safe `409 PLACEMENT_PENDING` response in a local contract test. An optional atomic file store proves one restart-safe idempotency path, but is intentionally single-process and not RDS. Default-off Terraform now also models the future private RDS boundary. See [redacted proof](evidence/SESSION_API_ANYWHERE_PROOF.md) and the [database foundation](DATABASE_FOUNDATION.md). | Replace local auth/store/CLI with Cognito, transactional RDS persistence, an ECS task role, and the AWS SDK. |
| Session API container | **Verified locally** | The local image builds successfully, runs as a non-root user, and returns `ok` from `/healthz`. Its default adapter is fake, so the container test has no AWS dependency. CI will build the image after the first repository push. | Keep its release discipline aligned with the verified Linux dedicated-server image. |
| Results-worker container | **Verified locally; managed runtime template validated; not deployed** | The idempotent Node worker has a non-root container artifact, SQS consumer entry point, PostgreSQL receipt-and-reward transaction adapter, and migration. The default local container proof remains isolated from AWS. The default-off Terraform service uses private subnets, no ingress, narrow SQS/secret access, 14-day logs, and desired count zero. | Push an immutable image, choose a private-egress strategy, run the migration with a narrower DB role, then perform an explicitly approved live demo. |
| Session API local benchmark | **Verified locally** | The fake-adapter test completed 40/40 requests at concurrency 10 with 26.59 ms p95 local HTTP latency. See [scoped evidence](evidence/SESSION_API_LOCAL_BENCHMARK.md). | Run a separate Unreal/server soak test; do not extrapolate API overhead to player capacity. |
| Linux dedicated-server artifact | **Verified locally; not deployed** | UE 5.8's v26 Linux cross-toolchain produced a 64-bit x86_64 ELF server. The server was cooked, staged, packed with IoStore, archived, built into a lean Amazon Linux 2023 runtime image that excludes `.debug` and `.sym` files, and smoke-tested as a non-root process bound to UDP `7777`. | Tag the tested image with a Git revision and scan it before any explicitly approved ECR push. See the [build plan](LINUX_SERVER_BUILD_PLAN.md). |
| GameLift managed-container definition | **Template validated; not deployed** | A versioned JSON template uses the installed Server SDK 5.6.0, reserves UDP `7777-7779`, and contains only placeholder ECR values. It is syntactically checked in CI. | Push a tested, revision-tagged image and replace placeholders only for an explicitly approved demo. |
| Match results workflow | **Verified locally; managed runtime template validated; not deployed** | A real Anywhere game session carried server-only match metadata. The dedicated server published `match.completed` to a local outbox; the worker processed XP exactly once and archived the event. An opt-in local file store proves the same event is rejected after a worker restart while preserving original rewards. Default-off Terraform now models encrypted SQS/DLQ, a private RDS boundary, and a desired-zero ECS worker that deletes a message only after its PostgreSQL transaction commits. See [redacted proof](evidence/LOCAL_MATCH_RESULTS_PROOF.md) and the [async foundation](ASYNC_RESULTS_FOUNDATION.md). | Run a time-boxed, explicitly approved SQS/RDS/ECS test after choosing private egress and applying the schema with a narrow DB role. |
| Terraform security foundation | **Validated locally; not deployed** | The `infra/` root has a zero-resource local default. The VPC, Cognito identity, and GitHub Actions OIDC trust modules are each opt-in, require an explicit demo flag and expiry tag, and deliberately avoid a NAT gateway and any deploy permission by default. No VPC, user pool, IAM role, ECS, RDS, or managed fleet was created. | Add remaining demo modules only for a short, tagged demo window. |
| CI quality gate | **Verified remotely; release-candidate workflow template validated; not deployed** | The public GitHub Actions workflow tests API/worker behavior, validates image/IaC contracts, builds both local containers, and proves the zero-resource plan. A manual release-candidate workflow builds candidate images and uploads source-revision/archive-hash evidence with no AWS credential, registry login, or deploy path. See [release workflow](RELEASE_CANDIDATE_WORKFLOW.md). | Add a separately protected, least-privilege image-publish/deployment workflow only for an approved cloud-test budget. |
| Managed hosting | **Planned** | The portfolio blueprint documents the intended hosted path, but no managed deployment exists. | Add after the local demo is reliably reproducible. |
| Observability / dashboards | **Local dashboard verified; CloudWatch template validated; not deployed** | A sanitized static dashboard derives real GameLift lifecycle, authoritative result, worker-processing, and graceful-shutdown evidence from local logs/outbox data. Default-off Terraform now models one CloudWatch dashboard and five alarms covering queue age, DLQ depth, ECS worker CPU/memory, and RDS free storage. Its alarm actions are empty unless an approved existing destination is supplied. See the [dashboard guide](LOCAL_OPERATIONS_DASHBOARD.md). | Add structured logs, choose approved alarm routing, and verify a controlled cloud failure during a time-boxed managed demo. |

## Current low-cost operating mode

- The active development proof uses a GameLift Servers Anywhere fleet with the
  workstation registered as its compute; it does not create managed EC2 capacity.
- Managed-cloud infrastructure is intentionally off.
- Local sessions are short-lived and are terminated with
  `Stop-GameLiftAnywhereSession.ps1` after each test.
- Player-session admission has been runtime-verified with both accepted and
  rejected local join attempts; the redacted evidence is stored with this
  project.

## Evidence standard for the public portfolio

Every public claim should be backed by at least one of these:

1. a repeatable script and sanitized output;
2. a focused server-log excerpt with identifiers redacted;
3. an architecture or decision record labelled as planned; or
4. a short screen recording of the exact tested flow.

Do not present the planned ECS, RDS, SQS, Terraform, FlexMatch, or multi-region
design as deployed until it has real, reproducible evidence.
