import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { assetVersionId } from './asset-pipeline.mjs';

const defaultApprovers = new Set(['stage-supervisor', 'production-manager']);

export function createStageApproval({ manifest, approvedBy, allowedApprovers = defaultApprovers }) {
  if (!(allowedApprovers instanceof Set ? allowedApprovers : new Set(allowedApprovers)).has(approvedBy)) {
    throw new Error('Stage approval rejected: approver is not authorized for this production.');
  }
  const versionId = assetVersionId(manifest);
  const manifestSha256 = createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
  return {
    workload: 'virtual-production',
    mode: 'local-simulation',
    event: 'stage_asset_approved',
    versionId,
    stageTarget: manifest.stageTarget,
    approval: {
      status: 'Approved for Stage',
      approvedBy,
      approvedAt: new Date().toISOString(),
      manifestSha256,
      deploymentInstruction: `Retrieve approved/${versionId}/ using the stage read-only role.`,
    },
    productionMapping: {
      authentication: 'Federated workstation or production identity assumes a scoped approval role',
      authorization: 'DynamoDB approval record accepts only authorized production approvers',
      delivery: 'Local stage assumes a read-only role for the approved object version',
      audit: 'Immutable version ID, manifest digest, actor, and timestamp are retained',
    },
    scope: 'Local authorization simulation only. No authenticated identity, IAM role, DynamoDB record, S3 object, or stage workstation is deployed.',
  };
}

export async function runStageApproval({ manifestPath, outputPath, approvedBy }) {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const approval = createStageApproval({ manifest, approvedBy });
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(approval, null, 2)}\n`);
  return approval;
}
