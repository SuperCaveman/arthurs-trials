# Local placement simulation

This small simulator produces repeatable **local synthetic evidence** for the
control-plane portion of Arthur's Trials. It is intentionally bounded and does
not contact AWS, start an Unreal process, or represent GameLift capacity.

It exercises the same local HTTP session-API boundary used by the portfolio
proof, with a simulated adapter that models a short admission delay and a
short match-completion delay. The output records each request's placement,
admission, and completion timing.

## Safe defaults

- At most 200 synthetic requests and concurrency 20.
- The default is 20 requests at concurrency 4.
- `SIM_DRY_RUN=true` validates the run shape without starting the local API.
- Output belongs under ignored `logs/`, so no measurement is accidentally
  committed as a production claim.

## Run it

From the repository root:

```powershell
$run = Get-Date -Format 'yyyyMMddHHmmss'
$env:SIM_REQUESTS = '20'
$env:SIM_CONCURRENCY = '4'
$env:SIM_ADMISSION_DELAY_MS = '15'
$env:SIM_COMPLETION_DELAY_MS = '30'
$env:SIM_OUT_DIR = Join-Path (Resolve-Path ./logs) "placement-simulation-$run"
node ./scripts/Run-PlacementLoadSimulation.mjs
```

The directory contains:

- `placement-simulation-results.csv` — one synthetic request per row.
- `placement-simulation-summary.json` — p50/p95/max aggregates.
- `placement-simulation-chart.svg` — an editable chart for the case study.

## How to present it

The chart itself states its scope. Describe it as a bounded local
control-plane simulation only. Do not use it to claim GameLift placement rate,
Unreal tick performance, player capacity, or cloud scalability. Those require
a separately approved managed test and measured Linux dedicated-server data.
