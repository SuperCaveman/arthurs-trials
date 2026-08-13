# Virtual-production managed-demo runbook

Status: **planning/runbook only — no virtual-production AWS resources have been deployed.**

This runbook is for a separately approved, short-lived demonstration of the
virtual-production workflow foundation. It is not part of normal development.
Normal development uses the local workflow proofs and has no AWS control-plane
dependency.

## What the optional slice would create

- A private, versioned S3 bucket for a single production namespace.
- An on-demand DynamoDB table for stage-approval metadata, with point-in-time
  recovery.
- A Standard Step Functions structural intake workflow, EventBridge rule/role,
  and a 14-day CloudWatch error log group.
- A read-only stage-delivery role trusted by one explicitly named existing
  identity.

It does **not** create a GPU/render host, LED-wall renderer, NAT gateway,
always-on service, managed GameLift capacity, database instance, or a public
asset bucket.

## Before any approved apply

1. Pick a single production ID such as `arthurs-trials-demo`; do not use one
   stage identity for multiple productions.
2. Establish a low budget alert in the target AWS account and an owner who will
   perform teardown the same day.
3. Choose the required existing trusted stage/federated principal ARN. The
   template refuses to enable the VP slice without it.
4. Set an expiration timestamp and record it with the demo evidence.
5. Review the plan. It must contain only the VP resources above plus any
   separately selected foundations. Do not combine it with unrelated gaming
   infrastructure unless that is explicitly in scope and budgeted.

## Safe planning command

From `infra/`, copy the example vars file and then plan with explicit flags.
The command below is a plan only; it does not create resources.

```powershell
Copy-Item terraform.tfvars.example terraform.tfvars
terraform init -backend=false -input=false
terraform plan -input=false `
  -var='deployment_mode=demo' `
  -var='allow_managed_demo=true' `
  -var='expires_at=2026-12-31T23:00:00Z' `
  -var='enable_virtual_production_assets=true' `
  -var='virtual_production_production_id=arthurs-trials-demo' `
  -var='virtual_production_stage_trusted_principal_arn=arn:aws:iam::<account-id>:role/<approved-stage-identity>'
```

Do not run `terraform apply` until the owner, budget, target account/region,
and same-day teardown window are explicitly approved.

## If an approved demo is applied

1. Upload a deliberately small test manifest/package under the production’s
   `incoming/` prefix; do not upload licensed or production-sensitive content.
2. Confirm the EventBridge rule starts the Step Functions intake check and that
   errors (if any) are retained only in the short CloudWatch log group.
3. Record approval metadata only for the test stage target.
4. Confirm the stage identity can read its approved production prefix but
   cannot write, delete, or read another production’s prefix.
5. Capture only sanitized evidence: no account IDs, role ARNs, object URLs,
   session credentials, or artist data in public footage.

The state machine’s current responsibility is structural object intake—not
Unreal Engine cooking or cloud rendering. Keep that evidence boundary visible.

## Teardown and next-day verification

At the end of the approved window, remove test content and destroy the
resource slice using the same variables used for the apply:

```powershell
terraform destroy -input=false `
  -var='deployment_mode=demo' `
  -var='allow_managed_demo=true' `
  -var='expires_at=2026-12-31T23:00:00Z' `
  -var='enable_virtual_production_assets=true' `
  -var='virtual_production_production_id=arthurs-trials-demo' `
  -var='virtual_production_stage_trusted_principal_arn=arn:aws:iam::<account-id>:role/<approved-stage-identity>'
```

Then verify:

- the S3 bucket is absent or empty as intended before deletion;
- the DynamoDB table, state machine, EventBridge rule, log group, and stage
  role are absent;
- no test content/version history remains unintentionally retained;
- the next-day billing/cost view shows no unexpected recurring resources.

Version history and point-in-time recovery are deliberately recoverability
features during a demo, but can retain data/cost. Make their removal an
explicit decision during teardown rather than assuming they disappear.

## Cost posture

S3 storage/version retention, DynamoDB on-demand activity plus recovery,
Step Functions executions, EventBridge events, and CloudWatch log ingestion
can all incur usage-based charges. The design avoids fixed compute/network
charges by default, but it is still not permission to leave a test deployed.
