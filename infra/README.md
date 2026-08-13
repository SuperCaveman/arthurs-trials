# Optional managed-demo infrastructure

This Terraform root is intentionally **default-off**. Its `local` mode plans
zero AWS resources. The optional slices currently model a two-AZ network
foundation, Cognito player identity, a permissionless GitHub Actions OIDC
trust role, an SQS/DLQ asynchronous-results foundation, and a private RDS
PostgreSQL foundation; none is enabled by default. It does not yet create ALB,
ECS, or managed GameLift capacity.

## Safe local validation

```powershell
cd infra
Copy-Item terraform.tfvars.example terraform.tfvars
terraform init -backend=false
terraform fmt -check -recursive
terraform validate
terraform plan
```

`terraform plan` in the copied default configuration should show no AWS
resources. In local mode, the provider skips credential and account validation;
it neither creates resources nor needs an AWS control-plane lookup. The local
state and `.terraform` directory are ignored.

## Future managed-demo gate

Do not apply this as part of ordinary development. An approved, time-boxed demo
must supply all three values at planning time:

```powershell
terraform plan `
  -var='deployment_mode=demo' `
  -var='allow_managed_demo=true' `
  -var='expires_at=2026-12-31T23:00:00Z'
```

To include the optional identity and delivery-trust foundations in that future
approved plan, set `enable_identity=true` and/or
`enable_github_actions_oidc=true`. OIDC additionally requires the account's
existing GitHub Actions provider ARN. The role contains trust only, not AWS
permissions; future resource modules will supply narrowly scoped policies.

Set `enable_async_results=true` only for the same approved demo window to add
the encrypted match-results queue and its DLQ. See the
[asynchronous-results foundation](../docs/ASYNC_RESULTS_FOUNDATION.md) for the
event, IAM, recovery, and cost boundaries.

Set `enable_database=true` only for the same approved demo window to add the
private, encrypted PostgreSQL instance. It starts with no ingress and requires
future application/worker security groups to be explicitly allowed. See the
[database foundation](../docs/DATABASE_FOUNDATION.md) for the security,
recovery, and teardown boundary.

See the [security and delivery foundation](../docs/SECURITY_DELIVERY_FOUNDATION.md)
for the trust boundary, cost posture, and production-scale changes.

The next IaC slices will add the private application/data layers only after
their cost and teardown plan are documented. Private subnets deliberately omit
a NAT gateway because it is a fixed hourly cost; the container design must make
an explicit endpoint-versus-NAT decision.
