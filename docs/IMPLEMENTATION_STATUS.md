# Implementation status and evidence

This document separates the working Arthur's Trials proof from the planned
production architecture. It is intentionally conservative: a planned component
is never described as deployed or tested.

Last reviewed: 2026-08-12

| Capability | Status | Evidence | Next proof |
| --- | --- | --- | --- |
| Unreal dedicated server | **Working locally** | A Win64 dedicated server runs headlessly and accepts a local client on the Third Person map. | Repeat the local test after each server change. |
| GameLift Servers Anywhere lifecycle | **Working locally** | The server has completed `InitSDK`, `ProcessReady`, health checks, game-session activation, and graceful `ProcessEnding`/`Destroy` against the real Anywhere fleet. | Capture a short, redacted lifecycle video and server-log excerpt. |
| GameLift health fault injection | **Verified locally** | The Anywhere launcher can opt in to one bounded failed health check with `-FailHealthChecks`. GameLift issued `TerminateProcess` for the unhealthy process; a clean replacement process then completed `ProcessReady` and returned healthy. It is disabled by default and guarded by a static CI contract test. | Repeat the controlled failure and replacement-process recovery test after lifecycle changes. |
| Game-session lifecycle | **Working locally** | The helper scripts create an Anywhere game session and terminate it through the GameLift termination callback. | Document session identifiers only in redacted evidence. |
| Player-session admission | **Verified locally** | The linked dedicated server accepted a real GameLift `PlayerSessionId` with `AcceptPlayerSession`, bound it to the player, and rejected a separate client without a credential during `PreLogin`. See [redacted proof](evidence/LOCAL_PLAYER_SESSION_PROOF.md). | Replace the local helper with the planned authenticated session API. |
| Client credential boundary | **Verified locally** | `New-GameLiftAnywherePlayerSession.ps1` returned only connection details plus a short-lived player-session credential; the Unreal client received no AWS credentials. See [redacted proof](evidence/LOCAL_PLAYER_SESSION_PROOF.md). | Replace the local helper with the planned authenticated session API. |
| Player authentication | **Terraform template validated locally; not deployed** | The opt-in Cognito user-pool/public-client module sets the intended identity boundary; it creates nothing in the zero-resource default plan. Local bearer authentication remains development-only. See the [security/delivery foundation](SECURITY_DELIVERY_FOUNDATION.md). | Implement JWT validation in the session API and verify a client cannot request another player's session. |
| Session API | **Verified locally; not deployed** | A dependency-free Node HTTP API enforces a local caller boundary, party ownership, idempotency, owner-only reads, and returns only connection details plus a player-session credential. Its Anywhere adapter created a real local GameLift session and credential that the dedicated server accepted. See [redacted proof](evidence/SESSION_API_ANYWHERE_PROOF.md). Cognito, RDS, and ECS are not present. | Replace local auth/store/CLI with Cognito, RDS, an ECS task role, and the AWS SDK. |
| Session API container | **Verified locally** | The local image builds successfully, runs as a non-root user, and returns `ok` from `/healthz`. Its default adapter is fake, so the container test has no AWS dependency. CI will build the image after the first repository push. | Keep its release discipline aligned with the verified Linux dedicated-server image. |
| Session API local benchmark | **Verified locally** | The fake-adapter test completed 40/40 requests at concurrency 10 with 26.59 ms p95 local HTTP latency. See [scoped evidence](evidence/SESSION_API_LOCAL_BENCHMARK.md). | Run a separate Unreal/server soak test; do not extrapolate API overhead to player capacity. |
| Linux dedicated-server artifact | **Verified locally; not deployed** | UE 5.8's v26 Linux cross-toolchain produced a 64-bit x86_64 ELF server. The server was cooked, staged, packed with IoStore, archived, built into a lean Amazon Linux 2023 runtime image that excludes `.debug` and `.sym` files, and smoke-tested as a non-root process bound to UDP `7777`. | Tag the tested image with a Git revision and scan it before any explicitly approved ECR push. See the [build plan](LINUX_SERVER_BUILD_PLAN.md). |
| GameLift managed-container definition | **Template validated; not deployed** | A versioned JSON template uses the installed Server SDK 5.6.0, reserves UDP `7777-7779`, and contains only placeholder ECR values. It is syntactically checked in CI. | Push a tested, revision-tagged image and replace placeholders only for an explicitly approved demo. |
| Match results workflow | **Verified locally; not deployed** | A real Anywhere game session carried server-only match metadata. The dedicated server published `match.completed` to a local outbox; the worker processed XP exactly once and archived the event. The Session API is contract-tested to pass the same metadata. The store is intentionally in-memory; no SQS, DLQ, RDS, or worker service exists. See [redacted proof](evidence/LOCAL_MATCH_RESULTS_PROOF.md). | Replace local input/store with SQS and transactional persistence. |
| Terraform security foundation | **Validated locally; not deployed** | The `infra/` root has a zero-resource local default. The VPC, Cognito identity, and GitHub Actions OIDC trust modules are each opt-in, require an explicit demo flag and expiry tag, and deliberately avoid a NAT gateway and any deploy permission by default. No VPC, user pool, IAM role, ECS, RDS, or managed fleet was created. | Add remaining demo modules only for a short, tagged demo window. |
| CI quality gate | **Verified remotely; expanded locally** | The public GitHub Actions workflow passed its first run: API and worker tests, local benchmark, container-recipe contracts, image build, Terraform format/validate, and a zero-resource-plan assertion. The current source adds a security/delivery contract check; it uses deliberately fake credentials in local mode and has no deploy step. See [run evidence](evidence/GITHUB_ACTIONS_FIRST_RUN.md). | Record the next green run, then add an explicitly approved, protected managed-demo release workflow only when there is a defined cloud-test budget. |
| Managed hosting | **Planned** | The portfolio blueprint documents the intended hosted path, but no managed deployment exists. | Add after the local demo is reliably reproducible. |
| Observability / dashboards | **Local dashboard verified; CloudWatch planned** | A sanitized static dashboard derives real GameLift lifecycle, authoritative result, worker-processing, and graceful-shutdown evidence from local logs/outbox data. See the [dashboard guide](LOCAL_OPERATIONS_DASHBOARD.md). | Add structured cloud logs, CloudWatch dashboard, and alarms only with the opt-in managed demo. |

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
