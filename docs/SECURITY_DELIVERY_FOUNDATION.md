# Security and delivery foundation

Status: **Terraform template validated locally; not deployed**

This slice makes the future managed demonstration inspectable without creating
an AWS resource during normal development. It does not authenticate a local
Unreal client yet, and it does not give GitHub permission to deploy.

## What is defined

| Foundation | Why it exists | Current boundary |
| --- | --- | --- |
| Cognito user pool | Gives the future session API a standards-based player identity source, so the Unreal client never needs AWS credentials. | It is an opt-in Terraform module only. No pool, users, client, or JWT validation path has been deployed. |
| Public Unreal app client | A distributed game client cannot keep a secret; the API validates its tokens server-side. | The app client is configured with `generate_secret = false`, token revocation, and user-existence protection. |
| GitHub Actions OIDC trust role | Replaces stored AWS keys with short-lived web-identity credentials for a future protected release. | The role trusts only `SuperCaveman/arthurs-trials` on `main`, but is deliberately permissionless. No workflow can deploy through it yet. |
| Explicit Terraform gate | Prevents accidental cloud creation and requires a time limit for any future demo. | `local` mode is still the default and its plan contains zero resource changes. |

## Security decisions

- The Unreal client will receive a Cognito token and a GameLift player-session
  credential, never AWS access keys.
- The session API, not the game client, will validate JWTs and call GameLift
  control-plane APIs.
- The OIDC trust policy pins both the GitHub token audience (`sts.amazonaws.com`)
  and subject (this repository's `main` branch). A release workflow will also
  require GitHub environment approval.
- The OIDC role has no permissions on purpose. Future resource modules must
  attach narrowly scoped policies alongside the resources they operate, rather
  than turning a reusable CI role into a broad administrator role.
- The manual release-candidate workflow is deliberately separate from OIDC. It
  builds and hashes local container archives but has no `id-token` permission,
  AWS configuration, registry login, or deploy step. This proves delivery
  discipline without turning evidence generation into cloud access.
- Authentication logs must never contain JWTs, player-session IDs, or email
  addresses. The local dashboard sanitization test remains part of CI.

## Cost posture

Nothing in this change is live. The normal Terraform plan has no AWS API calls
and no resource changes. If a later short managed demo enables Cognito, it
should use a small, pre-created test cohort and be torn down with the rest of
the demo stack. The OIDC role itself has no hourly charge, but it is still
behind the same approval and expiry gate for operational consistency.

## Production-scale evolution

For a real studio workload, use separate user pools or tenants per environment,
custom email delivery, appropriate MFA and recovery policy, token-key rotation
monitoring, and audit retention. Split OIDC duties into read-only plan, image
publish, and Terraform-apply roles; each should be bound to a protected GitHub
environment and the exact branches/tags that may assume it. Remote Terraform
state, permission boundaries, CloudTrail, and organization-level guardrails
would be added before any production deployment.

## Safe validation

```powershell
cd D:\AWS Projects\ArthursTrials\infra
terraform init -backend=false
terraform fmt -check -recursive
terraform validate
terraform plan
```

The final command must show no changes in the default configuration. Do not set
the `enable_*` flags or run `apply` without a separately approved, time-boxed
managed-demo session.
