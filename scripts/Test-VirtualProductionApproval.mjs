import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStageApproval, runStageApproval } from '../virtual-production/src/approval-workflow.mjs';

const manifest = { production: 'arthurs-trials-demo', assetName: 'Castle_Set', version: 12, source: { package: 'Castle_Set_v12.umap' }, stageTarget: 'local-stage-workstation-demo', checks: { requiredFiles: ['Castle_Set_v12.umap'], estimatedBytes: 1024 } };
const approval = createStageApproval({ manifest, approvedBy: 'stage-supervisor' });
assert.equal(approval.versionId, 'Castle_Set_v12');
assert.equal(approval.approval.status, 'Approved for Stage');
assert.match(approval.approval.deploymentInstruction, /approved\/productions\/arthurs-trials-demo\/Castle_Set_v12/);
assert.match(approval.scope, /No authenticated identity/i);
assert.throws(() => createStageApproval({ manifest, approvedBy: 'remote-artist' }), /not authorized/);

const root = await mkdtemp(join(tmpdir(), 'arthurs-trials-vp-approval-'));
try {
  const outputPath = join(root, 'approval.json');
  await runStageApproval({ manifestPath: new URL('../virtual-production/examples/Castle_Set_v12.asset-manifest.json', import.meta.url), outputPath, approvedBy: 'production-manager' });
  assert.equal(JSON.parse(await readFile(outputPath, 'utf8')).approval.approvedBy, 'production-manager');
  console.log('Verified: only approved production roles can authorize Castle_Set_v12 for stage delivery in the local authorization proof.');
} finally { await rm(root, { recursive: true, force: true }); }
