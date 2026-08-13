import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStageState, deployApprovedStageEnvironment } from '../virtual-production/src/stage-deployment.mjs';

const approval = { event: 'stage_asset_approved', production: 'arthurs-trials-demo', versionId: 'Castle_Set_v12', stageTarget: 'local-stage-workstation-demo', approval: { status: 'Approved for Stage', approvedBy: 'stage-supervisor', approvedAt: '2026-08-13T00:00:00.000Z', deploymentInstruction: 'Retrieve approved/productions/arthurs-trials-demo/Castle_Set_v12/ using the stage read-only role.' } };
const state = createStageState(approval);
assert.equal(state.event, 'stage_environment_selected');
assert.equal(state.assetDeliveryPath, 'approved/productions/arthurs-trials-demo/Castle_Set_v12/');
assert.match(state.scope, /No S3 object/i);
assert.throws(() => createStageState({ ...approval, event: 'stage_asset_requested' }), /Approved for Stage/);

const root = await mkdtemp(join(tmpdir(), 'arthurs-trials-vp-stage-'));
try {
  const approvalPath = join(root, 'approval.json');
  const stageStatePath = join(root, 'current-stage.json');
  await writeFile(approvalPath, JSON.stringify(approval));
  await deployApprovedStageEnvironment({ approvalPath, stageStatePath });
  const persisted = JSON.parse(await readFile(stageStatePath, 'utf8'));
  assert.equal(persisted.versionId, 'Castle_Set_v12');
  console.log('Verified: the local stage manifest atomically selects only an authorized approved Castle_Set_v12 environment.');
} finally { await rm(root, { recursive: true, force: true }); }
