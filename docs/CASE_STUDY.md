# Case study: Game-development multiplayer platform on AWS

## The problem

A small game-development team can make a fun Unreal prototype long before it
has a safe way to place players, run dedicated servers, persist authoritative
results, observe failures, or control cloud spending. Those needs often land on
multiplayer engineers, cloud/backend engineers, technical directors, studio
leads, and live-operations teams at once.

## The solution

Arthur's Trials is a deliberately small 2–4 player Unreal Engine co-op game
used as the workload for a cost-aware multiplayer platform. The game itself is
simple; the portfolio product is the dedicated-server lifecycle, session
control plane, results workflow, operational evidence, and production scale
path around it.

![Game-development multiplayer architecture](assets/arthurs-trials-architecture.svg)

## What is proven today

- A locally running Unreal dedicated server initializes and terminates through
  the real GameLift Servers Anywhere SDK lifecycle.
- A GameLift-issued player-session credential is required before the server
  admits a client; the Unreal client never holds AWS credentials.
- The local match-results worker handles replay safely through an idempotency
  key, including retry and poison-message simulations.
- GitHub Actions tests the contracts, builds containers, validates Terraform,
  and proves the normal infrastructure plan has zero resource changes.

## Engineering decisions that matter

### Dedicated-server authority is separate from player requests

The client can ask for a session, but cannot place fleets, determine results,
or possess AWS credentials. The dedicated server owns match outcome; the
results worker owns durable progression updates.

### Cost control is designed in

Normal development uses GameLift Servers Anywhere on the workstation. Managed
AWS services remain default-off behind an explicit consent, expiry, and
teardown gate. The design avoids persistent GPU resources and always-on compute
for the portfolio demonstration.

### The scale path is honest

The repository distinguishes locally verified behavior from a versioned,
Terraform-validated managed design. It does not describe an undeployed fleet,
database, or autoscaling policy as live production infrastructure.

## Scale path

| Stage | Operating model | Evidence boundary |
| --- | --- | --- |
| Development | Local Unreal and GameLift Servers Anywhere | Runtime verified locally |
| Scheduled demo | One region and short-lived managed capacity under an explicit cost gate | Designed and Terraform-validated; not deployed by default |
| Production | Regional placement, capacity buffers, hardened operational controls, and multi-region expansion as player demand requires | Architecture direction, not a performance claim |

## Portfolio takeaway

This is a production-shaped platform case study for teams shipping multiplayer
Unreal games: it shows how to evolve a playable prototype into secure,
observable, cost-aware dedicated-server operations.

For reproducible evidence, see the [implementation status](IMPLEMENTATION_STATUS.md),
[local GameLift runbook](RUNBOOK.md), and [architecture guide](ARCHITECTURE.md).
