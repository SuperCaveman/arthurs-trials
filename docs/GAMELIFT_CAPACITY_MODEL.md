# GameLift capacity model

Status: **Local planning tool validated; no managed capacity created**

[`../gamelift/capacity/capacity-model.input.example.json`](../gamelift/capacity/capacity-model.input.example.json)
is a deliberately conservative input file. The generator translates a measured
server budget into active sessions, spare sessions, and required hosting
instances for named player-concurrency scenarios.

```powershell
node ./scripts/Generate-GameLiftCapacityPlan.mjs `
  --input ./gamelift/capacity/capacity-model.input.example.json `
  --output ./logs/capacity/game-lift-capacity-plan.md
```

The generated file belongs in ignored `logs/`; it is a recording-friendly
artifact rather than a source-controlled claim about live performance.

## What it models

```text
concurrent players
  / players per session
  = active sessions (rounded up)
  + available-session buffer
  = total sessions required
  / sessions per hosting instance
  = instances required (rounded up)
```

It highlights when a scenario exceeds the configured instance maximum. That is
intentional: an exceeded ceiling means the operator must measure more, approve
a different capacity limit, or limit the demo—not silently assume that demand
will be absorbed.

## Inputs that must be measured before a managed demo

- Linux managed-container cold start from placement request to `ProcessReady`;
- peak CPU and memory per server process during a representative full session;
- the number of stable game-server processes/sessions per instance;
- match duration and disconnect/reconnect behavior;
- observed queue wait and placement failures at the chosen buffer;
- the lowest safe minimum capacity for the scheduled demo window.

The committed file says **example assumptions only**. It uses one process and
one session per instance to avoid overstating capacity before a managed
container test. The 25% buffer matches the initial scale-out threshold in the
[placement/capacity design](GAMELIFT_CAPACITY_PLACEMENT.md), but it is a policy
starting point, not an AWS recommendation or SLA.

## Why this is useful

GameLift scaling reacts to available session capacity, queue depth, and wait
time. A capacity model makes the otherwise hand-wavy connection between player
concurrency, dedicated-server measurements, fleet limits, and scale policy
auditable. AWS describes those fleet and queue metrics in its
[GameLift Servers monitoring guide](https://docs.aws.amazon.com/gameliftservers/latest/developerguide/monitoring-overview.html).

This generator makes no AWS API call. It does not create a fleet, start a
server, or assert that the sample values are production-safe.
