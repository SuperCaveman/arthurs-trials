# Threat model: Unreal Engine Cloud Platform on AWS

Status: **design and local-control evidence; no managed security service is deployed.**

This model covers the two workloads in Arthur's Trials: multiplayer gaming and
virtual-production asset workflow. It is intentionally specific about whether a
control is runtime-verified locally, template-validated, or still planned.

## Trust boundaries

```text
Unreal player client ──> Session API ──> GameLift / dedicated server
                                      └──> results worker / data store

Remote artist ──> asset intake ──> validation / approval ──> local stage
                                             └──> audit / recovery history
```

The Unreal client and remote artist are untrusted callers. The dedicated
server is authoritative for game outcomes. The local stage is trusted only to
read its approved production prefix; it cannot publish, delete, or approve
assets.

## Multiplayer threats and controls

| Threat | Control | Evidence boundary |
| --- | --- | --- |
| Player places sessions or holds AWS credentials | The client receives only connection details and a short-lived GameLift player-session credential. | **Verified locally** against GameLift Anywhere. |
| Player joins without reservation | Unreal `PreLogin`/`AcceptPlayerSession` rejects a missing or invalid player-session ID. | **Verified locally** with accepted and rejected joins. |
| Player requests a match for another user | Session API authenticates a caller and requires that caller in the party; owner-only match reads block direct-object access. | **Local API tested**; live Cognito is not deployed. |
| Duplicate client/retry awards XP twice | Server emits immutable completion events; worker records receipt/reward state idempotently and replay is rejected. | **Local file-store/worker proof**; SQS/RDS path is template-validated only. |
| Capacity exhaustion leaks provider internals | GameLift capacity errors map to player-safe `PLACEMENT_PENDING` response. | **Adapter/API contract tested**; managed queue not deployed. |
| Server or worker process fails silently | Health failure, graceful termination, retry, and DLQ behavior are tested locally; planned CloudWatch alarms are default-off. | **Local lifecycle/resilience proof**; CloudWatch not deployed. |

## Virtual-production threats and controls

| Threat | Control | Evidence boundary |
| --- | --- | --- |
| Wrong asset version reaches stage | Versioned manifest, structural preflight, explicit approval, and deployment instruction identify a specific asset version. | **Verified locally**; S3/DynamoDB not deployed. |
| Artist self-approves stage content | Local approval proof rejects `remote-artist`; only named production roles can approve. | **Verified locally**; future federated IAM/DynamoDB enforcement is template-validated. |
| One production reads another production’s content | Approved paths include `productions/<production>/`; future stage role is limited to one production prefix. | **Local namespace proof and Terraform policy contract**; no role deployed. |
| Newer asset is lost during recovery | Rollback restores a prior approved version without deleting the newer version; archive lifecycle retains noncurrent content. | **Local rollback proof and Terraform lifecycle contract**. |
| Intake event is forged or processes the wrong path | Future EventBridge rule matches only S3 Object Created events for `incoming/`; Step Functions confirms object existence before continuing. | **Terraform contract only**; no event bus or state machine deployed. |
| Approval/recovery event is replayed | Local append-only ledger derives a stable event ID and classifies replay as duplicate. | **Verified locally**; managed audit/log storage not deployed. |

## Data handling and logging

- Public recordings and committed evidence omit player-session IDs, JWTs,
  AWS account/fleet identifiers, object URLs, role ARNs, and artist content.
- Runtime evidence is generated under ignored local `logs/` paths. Checked-in
  evidence is redacted text that explains the claim without exposing a usable
  credential.
- The default infrastructure plan does not create a database, bucket, queue,
  log group, or identity service. A future managed demo requires explicit
  consent and an expiry tag.

## Residual risk and production hardening

The local proofs do not substitute for a production identity provider, private
network egress decision, central audit retention policy, intrusion detection,
key-management policy, rate limiting, or incident response process. Before a
real studio deployment, add threat-review ownership, production-specific IAM
roles, protected Terraform state, central log retention, abuse/rate controls,
and an approved recovery exercise.

The platform intentionally does not claim those controls are deployed today.
See [implementation status](IMPLEMENTATION_STATUS.md) for the current evidence
boundary and [security/delivery foundation](SECURITY_DELIVERY_FOUNDATION.md) for
the default-off infrastructure controls.
