# Results-worker resilience simulation

The production design uses SQS redrive and a DLQ so a failed reward event is
never silently lost or incorrectly acknowledged. This local simulation uses
the real `processOneSqsMessage` and idempotent worker code with an in-memory,
bounded SQS-semantics double. It creates no AWS resources.

It proves two narrow behaviors:

1. A controlled transient worker failure is not deleted, is retried, then
   succeeds exactly once on the next delivery.
2. A malformed poison message is not deleted; after three failed deliveries it
   moves to the simulated DLQ instead of looping forever.

## Run it

```powershell
$run = Get-Date -Format 'yyyyMMddHHmmss'
$env:RESILIENCE_SIM_OUT_DIR = Join-Path (Resolve-Path ./logs) "results-worker-resilience-$run"
node ./scripts/Run-ResultsWorkerResilienceSimulation.mjs
```

The generated JSON summary shows only safe disposition names, XP total, and
the simulated DLQ count. It contains no credentials, session IDs, or raw
payloads.

## Scope

This is evidence of the worker's retry/delete decision path, not a claim that
SQS, ECS, RDS, or a DLQ has been deployed. The opt-in Terraform foundation
still owns the managed redrive policy, and a live cloud test remains an
explicitly approved future step.
