# Linux server container smoke-test proof

Tested locally on 2026-08-12. No ECR image was pushed and no AWS resource was
created or changed.

## Artifact path

The UE 5.8 Linux Server package was cooked, staged, packed with IoStore, and
archived locally. Its deployable root has this contract:

```text
LinuxServer/
  ArthursTrials/Binaries/Linux/ArthursTrialsServer
  ArthursTrials/Content/Paks/
  Engine/Config/
```

## Image contract and result

The artifact was built into the local image `arthurs-trials-server:local` from
Amazon Linux 2023. The verified image runs as non-root user `arthurs`, exposes
only UDP `7777`, and has a measured unpacked size of about 367 MB. Unreal
`.debug` and `.sym` files remain in the archived package rather than being
copied into the runtime image.

A disposable container was started with a host mapping for UDP `7777`. The
server stayed running through Unreal Engine startup, selected the
`LinuxServer` device profile, and mounted the `GameLiftServerSDK` project
plugin. The test container was then stopped and removed.

This validates the packaged runtime and container boundary. It does not claim a
managed GameLift fleet: ECR push, container-group creation, and fleet capacity
remain deliberately opt-in cloud steps.

## Reproduction

```powershell
.\scripts\Build-LinuxServerImage.ps1 `
  -StagePath 'H:\ArthursTrials-LinuxPackage\Archive\LinuxServer' `
  -Tag 'arthurs-trials-server:local'

docker run --rm --name arthurs-trials-server-smoketest `
  -p 7777:7777/udp arthurs-trials-server:local
```
