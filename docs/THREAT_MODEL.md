# Threat model: Game-development multiplayer platform

Status: **design and local-control evidence; no managed security service is deployed.**

This model covers the multiplayer-game workload in Arthur's Trials. It is
intentionally specific about whether a control is runtime-verified locally,
template-validated, or still planned.

## Trust boundaries

```text
Unreal player client --> Session API --> GameLift / dedicated server
                                      --> results worker / data store
```

The player client is an untrusted caller. The dedicated server is authoritative
for game outcomes. Clients request sessions but cannot control fleet placement,
reward results, or AWS credentials.

## Multiplayer threats and controls

| Threat | Control | Evidence boundary |
| --- | --- | --- |
| Player places sessions or holds AWS credentials | The client receives only connection details and a short-lived GameLift player-session credential. | **Verified locally** against GameLift Anywhere. |
| Player joins without reservation | Unreal `PreLogin`/`AcceptPlayerSession` rejects a missing or invalid player-session ID. | **Verified locally** with accepted and rejected joins. |
| Player requests a match for another user | Session API authenticates a caller and requires that caller in the party; owner-only match reads block direct-object access. | **Local API tested**; live Cognito is not deployed. |
| Duplicate client/retry awards XP twice | Server emits immutable completion events; worker records receipt/reward state idempotently and replay is rejected. | **Local file-store/worker proof**; SQS/RDS path is template-validated only. |
| Capacity exhaustion leaks provider internals | GameLift capacity errors map to a player-safe `PLACEMENT_PENDING` response. | **Adapter/API contract tested**; managed queue not deployed. |
| Server or worker process fails silently | Health failure, graceful termination, retry, and dead-letter behavior are tested locally; planned CloudWatch alarms are default-off. | **Local lifecycle/resilience proof**; CloudWatch not deployed. |

## Data handling and logging

- Public recordings and committed evidence omit player-session IDs, JWTs, AWS
  account/fleet identifiers, role ARNs, and database connection strings.
- Runtime evidence is generated under ignored local `logs/` paths. Checked-in
  evidence is redacted text that explains the claim without exposing a usable
  credential.
- The default infrastructure plan does not create a database, queue, log group,
  or identity service. A future managed demo requires explicit consent and an
  expiry tag.

## Residual risk and production hardening

Local proofs do not substitute for a production identity provider, private
network egress decision, central audit retention policy, intrusion detection,
key-management policy, rate limiting, or incident response process. Before a
real studio deployment, add security-review ownership, production-specific IAM
roles, protected Terraform state, central log retention, abuse/rate controls,
and an approved recovery exercise.

The platform intentionally does not claim those controls are deployed today.
See [implementation status](IMPLEMENTATION_STATUS.md) for the current evidence
boundary and [security/delivery foundation](SECURITY_DELIVERY_FOUNDATION.md) for
the default-off infrastructure controls.
