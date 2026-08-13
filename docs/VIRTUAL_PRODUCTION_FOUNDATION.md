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

This is intentionally a local contract first. Terraform and AWS integration
remain default-off until the virtual-production workflow has the same clear
cost, security, and teardown guardrails as the gaming workload.

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
