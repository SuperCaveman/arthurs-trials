# Managed GameLift container preflight

Status: **locally verified; no ECR repository, container group, or managed fleet exists.**

The next hosted-game proof uses the already staged Linux dedicated-server
artifact and local Docker image. This preflight deliberately separates free
local validation from the paid managed-hosting actions.

## Local readiness check

Run this from the repository root:

```powershell
./scripts/Test-ManagedGameLiftContainerReadiness.ps1
```

It verifies that the staged Linux server exists and that the local image is
Linux/amd64, runs as the non-root `arthurs` user, and exposes UDP `7777`. It
does not call AWS, push an image, or create an AWS resource.

## Completed local inputs

- The staged Linux Unreal dedicated server is present on the high-capacity
  packaging drive.
- `arthurs-trials-server:local` is an Amazon Linux 2023 image of roughly
  367 MB, with the GameLift Server SDK included in the packaged server.
- The image was previously smoke-tested locally and exposes only the UDP game
  port.

## Explicit managed-demo approval gate

The following are the first paid cloud actions and require a separate explicit
approval and short teardown window:

1. Create or select a private ECR repository and push the tested image with an
   immutable tag/digest.
2. Create an IAM service role with the required GameLift managed-container
   permissions.
3. Create a GameLift game-server container group definition from that exact
   image and measured CPU/memory limits.
4. Create one single-region managed GameLift container fleet with the smallest
   measured capacity, wait for `ACTIVE`, create one redacted test session, and
   capture the result.
5. Delete the fleet, container-group definition, and ECR image/repository, and
   verify no managed capacity remains.

GameLift uses the image snapshot taken when a container-group definition is
created, so the image must be finalized and revision-tagged first. See AWS's
[container-group guidance](https://docs.aws.amazon.com/gameliftservers/latest/developerguide/containers-create-groups.html)
and [container-fleet guidance](https://docs.aws.amazon.com/gameliftservers/latest/developerguide/containers-build-fleet.html).

## Resource sizing rule

Do not guess the container group memory or vCPU limits. The local smoke test
establishes packaging compatibility, not production capacity. Before the live
fleet request, measure a short local server run and choose one conservative
container-group limit; the fleet test then records the observed startup time,
memory use, session limit, and teardown result.
