# Linux dedicated-server build plan

The present runtime proof uses the Win64 dedicated server with GameLift Servers
Anywhere. The Linux dedicated-server target is cross-compiled, cooked, staged,
packed, and archived locally. Its Amazon Linux 2023 container image has also
been built and smoke-tested locally. ECR and managed GameLift remain explicit,
opt-in cloud steps.

## Current check

The UE 5.8 v26 Linux cross-toolchain is installed at
`C:\UnrealToolchains\v26_clang-20.1.8-rockylinux8`, and UnrealBuildTool reports
the `Linux` target platform as valid. The `ArthursTrialsServer` Linux
Development build completed with conservative parallelism. Its output is a
64-bit little-endian x86_64 ELF executable.

## Completed local verification

- The Linux Server package was cooked and archived on the high-capacity H:
  drive, including the server executable, configuration, and IoStore content.
- The local image `arthurs-trials-server:local` was built from Amazon Linux
  2023, runs as the non-root `arthurs` user, and exposes UDP `7777`.
- A disposable container stayed running through Unreal Engine startup, selected
  the `LinuxServer` device profile, and mounted the GameLift Server SDK plugin.
  The container was then stopped and removed.

## Required toolchain

For Unreal Engine 5.8 on Windows, Epic lists the **v26, clang 20.1.8-based**
Linux cross-compile toolchain. Install the matching package from Epic's
[Linux development requirements](https://dev.epicgames.com/documentation/unreal-engine/linux-development-requirements-for-unreal-engine?lang=en-US),
then open a new terminal and verify:

```powershell
$env:LINUX_MULTIARCH_ROOT
```

The environment variable should point to the installed v26 toolchain root. Do
not substitute an older v22/v25 toolchain: those are for different UE releases.

## Conservative package sequence

1. Cook and stage the server with output directed to the high-capacity H: drive
   rather than the nearly full project drive.
2. Verify the staged executable, cooked content, configuration, and UDP port
   contract before adding a Dockerfile.
3. Build and health-check the image locally. ECR push and a managed GameLift
   fleet remain separate, explicitly approved demo steps.

This sequence deliberately avoids the high-memory Windows link behavior that
previously destabilized the workstation. The Linux compile used two actions at
a time; packaging uses the existing binary and does not recompile it.
