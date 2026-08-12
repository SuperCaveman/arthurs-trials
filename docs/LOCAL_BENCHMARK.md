# Local API benchmark

This is intentionally a narrow, reproducible check of the local session API's
HTTP/idempotency path with its fake GameLift adapter. It is **not** a game-server
load test, a GameLift placement benchmark, or a player-capacity claim.

Run it without AWS or Unreal:

```powershell
node scripts/Run-SessionApiLoadTest.mjs
```

Optional conservative parameters:

```powershell
$env:REQUESTS = 40
$env:CONCURRENCY = 10
node scripts/Run-SessionApiLoadTest.mjs
```

The output includes request count, concurrency, success/failure count, and
p50/p95/max HTTP latency. Record machine details and the exact output alongside
any future published result. Do not extrapolate this result to dedicated-server
scale; a later Unreal soak test must measure server tick time, CPU, memory,
network behavior, and concurrent sessions separately.
