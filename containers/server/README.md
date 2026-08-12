# Dedicated-server container artifact contract

The local proof uses the real **Windows** dedicated-server executable with
GameLift Servers Anywhere. The dedicated-server target is also cross-compiled
and packaged for Linux. The staged Linux package and its container image are
locally verified: the image starts the server as a non-root user, mounts the
GameLift Server SDK plugin, and binds UDP `7777`.

This remains a local artifact validation, not a deployed managed GameLift
container fleet. An image push, container-group definition, and fleet update
remain explicit, time-boxed demo decisions.

When the Linux build environment is ready, the container input must include:

- the packaged Linux server executable and all Unreal runtime dependencies;
- the cooked content and configuration produced by the same source revision;
- an explicit UDP game port (initially `7777`);
- a writeable log location; and
- the GameLift server process entry point and health/lifecycle configuration.

The image should be built locally, tagged with the Git revision and Unreal
version, scanned, and exercised before any ECR push or managed-fleet update.
Those cloud actions remain an explicit, time-boxed demo decision.

## Local image recipe (locally verified)

[`Dockerfile`](Dockerfile) expects its build context to be the staged Linux
server directory whose root contains `ArthursTrials/Binaries/Linux/`.
[`../../scripts/Build-LinuxServerImage.ps1`](../../scripts/Build-LinuxServerImage.ps1)
checks that contract before invoking Docker. It does not push an image or call
AWS. The script can be used only after Unreal produces the staged package:

```powershell
.\scripts\Build-LinuxServerImage.ps1 `
  -StagePath 'H:\ArthursTrials-LinuxPackage\Archive\LinuxServer' `
  -Tag 'arthurs-trials-server:local'
```

The default process runs as a non-root user, writes logs inside the staged
project directory, and declares UDP `7777`. The local smoke test launches this
image with `-p 7777:7777/udp`, verifies that the server remains running, then
removes the disposable container. The runtime image excludes Unreal `.debug`
and `.sym` files; those remain in the archived package for postmortem
symbolication. The GameLift template keeps the
larger `7777-7779` reservation so a later explicit capacity decision can add
processes without changing the external port contract.

## Managed-container definition template

[`gamelift-game-server-container.template.json`](gamelift-game-server-container.template.json)
is a versioned, non-deployable input for the eventual GameLift Servers managed
container group. It matches the installed GameLift Server SDK 5.6.0 and reserves
the UDP range `7777-7779` for one server process. Replace the image placeholders
only after a Linux artifact has been packaged, locally tested, and pushed to ECR
in the target Region.

When a managed demo is approved, this file will be passed as the game-server
container definition to `create-container-group-definition`, together with
separate, measured CPU/memory limits. Those resource limits intentionally are
not guessed in advance.
