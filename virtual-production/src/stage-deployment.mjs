import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

function createStageState(approval) {
  if (approval?.event !== 'stage_asset_approved' || approval?.approval?.status !== 'Approved for Stage') {
    throw new Error('Stage deployment rejected: an authorized Approved for Stage record is required.');
  }
  if (!/^[a-z0-9-]{3,64}$/.test(approval.production ?? '')) {
    throw new Error('Stage deployment rejected: approval must include a production namespace.');
  }
  if (!/^approved\/productions\/[a-z0-9-]{3,64}\/[A-Za-z0-9_]+_v\d+\/$/.test(approval.approval.deploymentInstruction?.match(/approved\/productions\/[a-z0-9-]{3,64}\/[A-Za-z0-9_]+_v\d+\//)?.[0] ?? '')) {
    throw new Error('Stage deployment rejected: approval has no safe approved-version delivery path.');
  }
  return {
    workload: 'virtual-production',
    mode: 'local-simulation',
    event: 'stage_environment_selected',
    production: approval.production,
    stageTarget: approval.stageTarget,
    versionId: approval.versionId,
    assetDeliveryPath: approval.approval.deploymentInstruction.match(/approved\/productions\/[a-z0-9-]{3,64}\/[A-Za-z0-9_]+_v\d+\//)[0],
    approvedBy: approval.approval.approvedBy,
    approvedAt: approval.approval.approvedAt,
    selectedAt: new Date().toISOString(),
    localStageInstruction: 'Local Unreal stage launcher reads this state and opens the selected approved environment.',
    scope: 'Local stage-selection simulation only. No S3 object is retrieved and no Unreal render process is launched by this script.',
  };
}

export async function deployApprovedStageEnvironment({ approvalPath, stageStatePath }) {
  const approval = JSON.parse(await readFile(approvalPath, 'utf8'));
  const state = createStageState(approval);
  await mkdir(dirname(stageStatePath), { recursive: true });
  const temporaryPath = `${stageStatePath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`);
  await rename(temporaryPath, stageStatePath);
  return state;
}

export { createStageState };
