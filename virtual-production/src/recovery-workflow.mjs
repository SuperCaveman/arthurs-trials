import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { assetVersionId } from './asset-pipeline.mjs';

function compatibleVersions(current, recovery) {
  return current.production === recovery.production
    && current.assetName === recovery.assetName
    && current.stageTarget === recovery.stageTarget
    && recovery.version < current.version;
}

export function createRollbackWorkflow({ current, recovery, approvedBy = 'portfolio-operator' }) {
  if (!compatibleVersions(current, recovery)) throw new Error('Rollback requires an earlier version of the same asset, production, and stage target.');
  return {
    workload: 'virtual-production',
    mode: 'local-simulation',
    production: current.production,
    assetName: current.assetName,
    currentVersion: assetVersionId(current),
    rollbackVersion: assetVersionId(recovery),
    stageTarget: current.stageTarget,
    recovery: {
      requestedBy: approvedBy,
      preservedVersions: [assetVersionId(recovery), assetVersionId(current)],
      actions: ['Validate prior approved manifest', 'Retrieve prior approved version', 'Switch local stage manifest atomically', 'Retain newer version for audit and recovery'],
      finalStageVersion: assetVersionId(recovery),
    },
    productionMapping: {
      versionHistory: 'S3 object versioning plus metadata record',
      rollbackGate: 'Authenticated approval/audit event',
      stageSwitch: 'Stage workstation retrieves a specific approved version',
      archive: 'S3 lifecycle transitions older versions to lower-cost storage',
    },
    scope: 'Local deterministic rollback simulation only. No S3 version, database record, IAM role, archive tier, or stage workstation is deployed.',
  };
}

export async function runRollbackWorkflow({ currentManifestPath, recoveryManifestPath, outputPath, approvedBy }) {
  const [current, recovery] = await Promise.all([
    readFile(currentManifestPath, 'utf8').then(JSON.parse),
    readFile(recoveryManifestPath, 'utf8').then(JSON.parse),
  ]);
  const workflow = createRollbackWorkflow({ current, recovery, approvedBy });
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(workflow, null, 2)}\n`);
  return workflow;
}
