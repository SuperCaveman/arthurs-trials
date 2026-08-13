# GameLift capacity and placement design

Status: **Templates validated locally; no managed queue, alias, fleet, or scaling policy deployed**

The working local proof uses a GameLift Servers Anywhere fleet and real server
lifecycle callbacks. This document captures the next managed-hosting shape
without pretending it is already running: a game session queue directs
placement to a revisioned managed-container fleet, and conservative capacity
policies protect players before they encounter an exhausted server process.

## Placement queue

[`../gamelift/queues/arthurs-trials-demo-queue.template.json`](../gamelift/queues/arthurs-trials-demo-queue.template.json)
is a placeholder-safe request body for an approved `create-game-session-queue`
operation. It contains no account IDs, live fleet IDs, aliases, or notification
targets.

The templates were syntax-checked with the installed AWS CLI's local request
serializer using `--generate-cli-skeleton output`; that command made no AWS API
call. They still require a live, approved validation before any resource is
created.

| Choice | Template setting | Why it matters |
| --- | --- | --- |
| Queue timeout | 120 seconds | Bounds how long a player waits before the API can return a clear placement outcome. |
| Queue destination | Alias placeholder, not a fleet ID | Lets a rollout move a queue between immutable fleet versions without changing the client-facing placement route. |
| Priority order | latency → cost → destination → location | Gives player latency the first decision while allowing a cost-aware fallback after the latency data is satisfied. |
| Latency policy | 80 ms initially; 120 ms after 20 s; 160 ms after 45 s | Makes the quality/wait trade-off explicit and observable. |
| Notification target | Deliberately absent | Avoids creating an SNS dependency until an approved operator route exists. |

The session API, never Unreal clients, submits placement requests with each
player's measured latency. The actual fleet/alias values are intentionally
placeholders; an approved managed demo must validate the request against the
then-current AWS CLI/API schema before creation.

Amazon GameLift Servers queues make placement decisions using capacity,
location, cost, and latency. AWS documents both configurable queue priorities
and timed player-latency policies in its [queue placement guidance](https://docs.aws.amazon.com/gameliftservers/latest/developerguide/queues-design-priority.html)
and [game-session queue API reference](https://docs.aws.amazon.com/gameliftservers/latest/apireference/API_GameSessionQueue.html).

## Capacity buffer policies

The pair of template files under `gamelift/scaling/` describe the initial
managed-fleet policies:

| Policy | Signal | Action | Intent |
| --- | --- | --- | --- |
| Scale out | `PercentAvailableGameSessions` ≤ 25 for 3 periods | Add one hosting instance | Restore a small session buffer before placement failures rise. |
| Scale in | `PercentAvailableGameSessions` ≥ 60 for 15 periods | Remove one hosting instance | Release truly sustained idle capacity slowly, avoiding saw-tooth scaling. |

The required fleet minimum/desired/maximum capacity is deliberately **not**
hard-coded. It must follow a measured Linux server budget: available sessions
per host, match duration, memory/CPU headroom, cold-start time, and the
smallest safe player buffer. For a low-cost demo, keep the fleet off except for
a scheduled test window and measure the first-placement delay rather than
claiming scale-to-zero behavior that has not been observed.

GameLift Servers supports rule-based capacity scaling using fleet and queue
metrics, including available sessions, queue depth, and wait time. See the
[rule-based scaling guide](https://docs.aws.amazon.com/gameliftservers/latest/developerguide/fleets-autoscaling-rule.html)
and [monitoring overview](https://docs.aws.amazon.com/gameliftservers/latest/developerguide/monitoring-overview.html).

## Operational workflow

```text
Authenticated session API
  -> StartGameSessionPlacement with per-player latency
  -> GameLift queue checks compatible alias/fleet capacity
  -> managed container server receives ProcessParameters
  -> ProcessReady -> game session activation -> player-session admission
  -> queue / fleet metrics drive bounded scaling policy
  -> API reports placement state without revealing AWS credentials
```

For a production rollout, use an alias per immutable fleet version, at least a
second location/fleet for recovery, measured latency beacons, queue failure
alarms, and a tested drain/rollback procedure. Those are design requirements,
not claims of this small project having multi-region capacity.

## Cost and safety boundary

These JSON files, their static tests, and the documentation create no AWS
resources and make no API calls. A future live run must be separately approved,
time-boxed, and include: an image digest, capacity limits, an expiration tag,
an operator notification route, an explicit teardown command, and sanitized
evidence of a successful and a failed/timed-out placement.
