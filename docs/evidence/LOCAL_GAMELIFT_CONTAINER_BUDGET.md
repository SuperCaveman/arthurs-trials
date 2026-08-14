# Local GameLift container budget baseline

Date: 2026-08-13

## Test

The locally built `arthurs-trials-server:local` Linux server image was run for
20 seconds with an explicit `--cpus 1` and `--memory 2g` Docker limit. It bound
the container's UDP `7777` port to local UDP `7778`, reached Unreal's entry-map
startup, remained running, and was removed immediately after stats collection.

## Observed startup sample

| Measure | Result |
| --- | --- |
| Container status | Running after 20 seconds |
| CPU at sample | 3.02% of the one-vCPU cap |
| Memory at sample | 108.4 MiB of 2 GiB (5.29%) |
| Runtime user / platform | Non-root `arthurs`; Linux/amd64 |
| Cloud resources | None created |

## Interpretation

This is a conservative **startup compatibility baseline** for a first
single-container GameLift test: one vCPU and 2048 MiB. It is not a session
capacity, peak-memory, tick-rate, or autoscaling claim. A managed fleet test
must record real GameLift startup time, player admission, CPU/memory under a
session, and teardown before raising or lowering its capacity policy.
