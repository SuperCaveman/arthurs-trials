# Game-development multiplayer platform architecture

![Arthur's Trials game-development multiplayer architecture](assets/arthurs-trials-architecture.svg)

Arthur's Trials demonstrates the infrastructure a game-development team needs
to operate a small Unreal Engine multiplayer game without keeping expensive
cloud capacity running between demos.

## Evidence boundary

The diagram intentionally separates two states:

- **Teal — verified locally.** Unreal client and dedicated server, the real
  GameLift Servers Anywhere lifecycle, player-session admission, health
  behavior, authoritative results, and graceful termination have local proof.
- **Purple — default-off managed AWS design.** The VPC, identity, session API,
  containerized GameLift fleet, queue, worker, database, observability, and
  release controls are versioned and validated, but are not deployed unless a
  separately approved, time-boxed demo creates them.

## What problem it solves

Small multiplayer teams need a path from a playable Unreal prototype to a
repeatable dedicated-server operation. This design keeps player requests,
server authority, results processing, deployment controls, and capacity policy
separate so the team can operate a live game without handing cloud credentials
or authoritative decisions to clients.

## Runtime flow

1. An Unreal client authenticates and requests a session through the control
   plane; it does not receive AWS credentials.
2. The session API performs ownership and idempotency checks, then requests a
   GameLift placement.
3. GameLift allocates a server process and returns player-session credentials.
4. The dedicated Unreal server admits only valid player sessions and owns match
   authority.
5. A result event flows through the asynchronous worker path, with idempotency,
   retry, and dead-letter handling designed into the contract.
6. Logs, metrics, alarms, runbooks, and tagged cost controls support a short
   managed demo and a later production-scale rollout.

## Scale path

| Stage | Operating model | Evidence boundary |
| --- | --- | --- |
| Development | Local Unreal and GameLift Servers Anywhere | Runtime verified locally |
| Scheduled demo | One region, short-lived managed capacity under explicit cost approval | Terraform validated; default-off |
| Production | Regional queue placement, fleet buffers, observability, incident runbooks, and multi-region design as demand requires | Architecture direction, not a current capacity claim |

## Security and cost posture

- No client AWS credentials; session placement and results authority remain on
  trusted server-side components.
- Private managed services, least-privilege IAM, and CI release controls are
  part of the versioned design.
- Normal Terraform planning creates zero AWS resources. Any managed demo needs
  explicit consent, a time limit, and teardown.
- Persistent GPU capacity, NAT gateways, and always-on compute are deliberately
  excluded from the default path.

For the concrete operational status, see
[implementation status](IMPLEMENTATION_STATUS.md),
[the GameLift runbook](RUNBOOK.md), and
[the threat model](THREAT_MODEL.md).
