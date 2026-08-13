# Virtual-production foundation

This is the second workload of the **Unreal Engine Cloud Platform on AWS**
portfolio. It deliberately keeps the latency-sensitive Unreal stage/render
workstation local. AWS is the production workflow around that workstation, not
the LED-wall rendering path.

## First reproducible proof: `Castle_Set_v12`

The local workflow simulator tracks a concrete version through:

`Uploaded → Processing → Validated → Approved for Stage → Deployed`

It writes a local JSON record with a manifest SHA-256, status transitions,
roles, and the production AWS mapping. It creates no cloud resources.

```powershell
$run = Get-Date -Format 'yyyyMMddHHmmss'
node ./scripts/Run-VirtualProductionAssetFlow.mjs `
  --manifest ./virtual-production/examples/Castle_Set_v12.asset-manifest.json `
  --output "./logs/virtual-production/Castle_Set_v12-$run.json"
```

## Production mapping

| Workflow step | Planned AWS responsibility | Why it exists |
| --- | --- | --- |
| Artist publish | S3 versioned storage | Preserves recoverable versions. |
| Processing/validation | EventBridge plus Step Functions/Lambda | Decouples validation from artist upload. |
| Approval | Authenticated metadata/approval record | Prevents unreviewed content reaching a stage. |
| Stage retrieval | Least-privilege approved-version access | Keeps the local stage workstation on approved assets. |
| Retention | S3 lifecycle/archive | Reduces cost while preserving rollback options. |

This is intentionally a local contract first. The separately optional Terraform
slice below remains default-off; it has the same clear cost, security, and
teardown guardrails as the gaming workload.

## Recording-friendly workflow view

Turn any generated workflow JSON into a safe HTML dashboard:

```powershell
node ./scripts/Generate-VirtualProductionDashboard.mjs `
  --workflow ./logs/virtual-production/Castle_Set_v12-<run>.json `
  --output ./logs/virtual-production/Castle_Set_v12-dashboard.html
```

It is deliberately labelled as a local simulation. The screen is useful for a
future VP portfolio clip because it makes the version, approval gate, local
stage target, and AWS responsibility boundaries visible in one place.

## Recovery and rollback proof

`Castle_Set_v11` is retained as an earlier approved version. The local recovery
workflow switches the simulated stage manifest from `v12` back to `v11` while
retaining `v12` for audit and future recovery:

```powershell
node ./scripts/Run-VirtualProductionRollback.mjs `
  --current ./virtual-production/examples/Castle_Set_v12.asset-manifest.json `
  --recovery ./virtual-production/examples/Castle_Set_v11.asset-manifest.json `
  --output ./logs/virtual-production/Castle_Set_rollback.json
```

In the production architecture, S3 version history and an authenticated
approval record preserve the same rollback boundary; lifecycle policy moves
older content to lower-cost archive storage without erasing recovery history.

## Default-off AWS storage and approval foundation

The repository now contains a Terraform template for the future managed
workflow. It is validated in CI but has not been applied, and the default
`local` plan still creates **zero AWS resources**.

| Component | Problem solved | Security and cost posture |
| --- | --- | --- |
| Private versioned S3 bucket | Recoverable Unreal environment packages and manifests | All public access is blocked; objects use S3-managed encryption; versioning preserves older assets. Noncurrent versions transition to S3 Glacier Instant Retrieval after 90 days but are not deleted by the template. |
| DynamoDB approval metadata | Records which asset version is approved for which local stage target | On-demand billing avoids idle database capacity. Point-in-time recovery and server-side encryption preserve approval history. |
| Local stage workstation | Keeps render latency off the network | Not an AWS resource. A future least-privilege integration retrieves a specifically approved version only. |

The future managed plan requires the same explicit `deployment_mode=demo`,
`allow_managed_demo=true`, and valid `expires_at` gate as every other cloud
slice, plus `enable_virtual_production_assets=true`. It creates no GPU, render
host, NAT gateway, or always-on application service. Do not apply it without a
separate time-boxed budget and a teardown decision; S3 storage/version history
and DynamoDB backup retention can accrue cost while retained.
