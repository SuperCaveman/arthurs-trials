# Optional managed-demo infrastructure

This Terraform root is intentionally **default-off**. Its `local` mode plans
zero AWS resources. The first opt-in slice is only the two-AZ network
foundation; it does not yet create ALB, ECS, RDS, SQS, or managed GameLift
capacity.

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

The next IaC slices will add the private application/data layers only after
their cost and teardown plan are documented. Private subnets deliberately omit
a NAT gateway because it is a fixed hourly cost; the container design must make
an explicit endpoint-versus-NAT decision.
