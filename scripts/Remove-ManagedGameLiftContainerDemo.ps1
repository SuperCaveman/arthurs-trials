[CmdletBinding(SupportsShouldProcess, ConfirmImpact = 'High')]
param(
    [Parameter(Mandatory)]
    [string]$FleetId,

    [Parameter(Mandatory)]
    [string[]]$ContainerGroupName,

    [Parameter(Mandatory)]
    [string]$RepositoryName,

    [Parameter(Mandatory)]
    [string]$RoleName,

    [string]$Region = 'us-east-1'
)

$ErrorActionPreference = 'Stop'
$managedPolicyArn = 'arn:aws:iam::aws:policy/GameLiftContainerFleetPolicy'

function Invoke-Aws {
    param([string[]]$Arguments)

    & aws @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "AWS CLI command failed: aws $($Arguments -join ' ')"
    }
}

function Wait-ForFleetDeletion {
    param([string]$Id)

    do {
        Start-Sleep -Seconds 10
        $query = & aws gamelift describe-container-fleet --fleet-id $Id --region $Region --output json 2>&1

        if ($LASTEXITCODE -eq 0) {
            continue
        }

        $queryText = $query | Out-String
        if ($queryText -match 'NotFoundException') {
            return
        }

        throw "Could not verify fleet deletion: $queryText"
    } while ($true)
}

if (-not $PSCmdlet.ShouldProcess(
        "fleet=$FleetId, container groups=$($ContainerGroupName -join ','), ECR=$RepositoryName, role=$RoleName",
        'Delete the temporary managed GameLift container demo resources')) {
    return
}

# A fleet owns its capacity and references its container group. Remove and
# confirm it first so no managed compute is left running or billed.
Invoke-Aws @('gamelift', 'delete-container-fleet', '--fleet-id', $FleetId, '--region', $Region)
Wait-ForFleetDeletion -Id $FleetId

foreach ($groupName in $ContainerGroupName) {
    Invoke-Aws @('gamelift', 'delete-container-group-definition', '--name', $groupName, '--region', $Region)
}
Invoke-Aws @('ecr', 'delete-repository', '--repository-name', $RepositoryName, '--force', '--region', $Region)
Invoke-Aws @('iam', 'detach-role-policy', '--role-name', $RoleName, '--policy-arn', $managedPolicyArn)
Invoke-Aws @('iam', 'delete-role', '--role-name', $RoleName)

Write-Host 'Managed GameLift demo fleet, container definition, ECR repository, and IAM role removed.'
