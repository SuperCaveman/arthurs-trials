# Managed GameLift container demo evidence

Date: 2026-08-14  
Scope: one short, single-region managed GameLift Servers container-fleet proof

## What was verified

- A private ECR repository accepted an immutable, revision-tagged Linux/amd64
  Unreal dedicated-server image.
- A GameLift service role used the AWS-managed `GameLiftContainerFleetPolicy`.
- A GameLift game-server container-group definition used Amazon Linux 2023,
  the GameLift Server SDK 5.6.0, one vCPU, 2048 MiB, and UDP `7777-7779`.
- The managed fleet reached `ACTIVE` in `us-east-1` on a single `c5.large`.
  It was explicitly capped at one game-server container group per instance,
  and the capacity view reported one active, idle instance/container group.
- A real one-player GameLift game session reached `ACTIVE` on port `7777`.
- The default-off managed-fleet session API adapter created that session and
  returned only the connection address, port, and caller's player-session
  credential. It cannot create a fleet or image.
- A staged Unreal client used that API-issued credential to join the managed
  server. The local client log recorded `Welcomed by server`; no AWS credential
  was placed in the client.
- The final container image enabled GameLift player-session validation, so the
  client-join proof exercised the same admission boundary as the local
  GameLift Anywhere proof.
- The managed fleet deployment and game-session console views were recorded
  with account, fleet, compute, session, and public-address identifiers
  redacted.

## Issue found and corrected

The first image ran the dedicated server without `-GameLiftEnabled`. GameLift
correctly held that fleet in its Server SDK connectivity check because the
process never called `InitSDK` and `ProcessReady`. The container entry point
was corrected, then the final proof image also enabled
`-GameLiftRequirePlayerSession`. New immutable image tags and container groups
were used for the corrections; the replacement fleet reached `ACTIVE`, hosted
the test session, and accepted the staged-client join.

This is useful evidence of an operational debugging boundary, not a claim
that every container image is automatically GameLift-ready.

## Cost controls and teardown

- No VPC, NAT gateway, database, ECS service, GPU, or additional managed fleet
  was created for this proof.
- The fleet maximum was one instance and one container group.
- After capture, the game session terminated and the fleet deletion was
  requested. The capacity API then reported zero active, idle, and
  terminating instances.
- Both temporary container-group definitions, the temporary ECR repository
  (including its images), and the temporary IAM role were directly verified
  deleted.
- GameLift can retain a `DELETING` control-plane record while finalizing the
  fleet deletion; it had no running capacity at the documented checkpoint.

## Boundary

This was a one-session managed-hosting proof, not a load test, autoscaling
benchmark, production deployment, or a claim of player-capacity limits.
