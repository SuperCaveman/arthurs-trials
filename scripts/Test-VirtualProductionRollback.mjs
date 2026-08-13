import assert from 'node:assert/strict';
import { createRollbackWorkflow } from '../virtual-production/src/recovery-workflow.mjs';

const baseline = { production: 'arthurs-trials-demo', assetName: 'Castle_Set', version: 11, source: { package: 'Castle_Set_v11.umap' }, stageTarget: 'local-stage-workstation-demo', checks: { requiredFiles: ['Castle_Set_v11.umap'], estimatedBytes: 1 } };
const current = { ...baseline, version: 12, source: { package: 'Castle_Set_v12.umap' }, checks: { requiredFiles: ['Castle_Set_v12.umap'], estimatedBytes: 1 } };
const workflow = createRollbackWorkflow({ current, recovery: baseline, approvedBy: 'stage-supervisor' });
assert.equal(workflow.currentVersion, 'Castle_Set_v12');
assert.equal(workflow.recovery.finalStageVersion, 'Castle_Set_v11');
assert.deepEqual(workflow.recovery.preservedVersions, ['Castle_Set_v11', 'Castle_Set_v12']);
assert.match(workflow.scope, /No S3 version/i);
assert.throws(() => createRollbackWorkflow({ current: baseline, recovery: current }), /earlier version/);
console.log('Verified: the local VP rollback workflow restores Castle_Set_v11 while retaining Castle_Set_v12 for audit and recovery, without cloud resources.');
