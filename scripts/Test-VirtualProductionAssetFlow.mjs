import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAssetWorkflow, runAssetWorkflow } from '../virtual-production/src/asset-pipeline.mjs';

const manifest = { production: 'arthurs-trials-demo', assetName: 'Castle_Set', version: 12, source: { artistWorkstation: 'remote-unreal-artist-demo', unrealEngine: '5.8', package: 'Castle_Set_v12.umap' }, stageTarget: 'local-stage-workstation-demo', checks: { requiredFiles: ['Castle_Set_v12.umap'], estimatedBytes: 1024 } };
const workflow = createAssetWorkflow(manifest, { approvedBy: 'stage-supervisor' });
assert.equal(workflow.versionId, 'Castle_Set_v12');
assert.equal(workflow.currentStatus, 'Deployed');
assert.equal(workflow.asset.storagePrefix, 'productions/arthurs-trials-demo');
assert.deepEqual(workflow.transitions.map((transition) => transition.status), ['Uploaded', 'Processing', 'Validated', 'Approved for Stage', 'Deployed']);
assert.match(workflow.scope, /No S3 bucket/i);
const root = await mkdtemp(join(tmpdir(), 'arthurs-trials-vp-'));
try {
  const path = join(root, 'workflow.json');
  await runAssetWorkflow({ manifestPath: new URL('../virtual-production/examples/Castle_Set_v12.asset-manifest.json', import.meta.url), outputPath: path });
  assert.equal(JSON.parse(await readFile(path, 'utf8')).versionId, 'Castle_Set_v12');
  console.log('Verified: the local virtual-production workflow tracks Castle_Set_v12 from upload through approved stage deployment without AWS resources.');
} finally {
  await rm(root, { recursive: true, force: true });
}
