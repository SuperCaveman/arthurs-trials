import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWorkflowDashboard } from '../virtual-production/src/workflow-dashboard.mjs';

const root = await mkdtemp(join(tmpdir(), 'arthurs-trials-vp-dashboard-'));
try {
  const workflowPath = join(root, 'workflow.json');
  const outputPath = join(root, 'dashboard.html');
  await writeFile(workflowPath, JSON.stringify({ versionId: 'Castle_Set_v12', asset: { package: 'Castle_Set_v12.umap', estimatedBytes: 1024 }, stageTarget: 'local-stage-workstation-demo', transitions: [{ status: 'Uploaded', actor: 'artist' }, { status: 'Processing', actor: 'pipeline' }, { status: 'Validated', actor: 'pipeline' }, { status: 'Approved for Stage', actor: 'supervisor' }, { status: 'Deployed', actor: 'stage' }], productionMapping: { upload: 'S3 versioned object storage' }, scope: 'Local deterministic simulation only. No S3 bucket is deployed.' }));
  await createWorkflowDashboard({ workflowPath, outputPath });
  const html = await readFile(outputPath, 'utf8');
  assert.match(html, /Castle_Set_v12/);
  assert.match(html, /Approved for Stage/);
  assert.match(html, /No AWS resources deployed/);
  assert.doesNotMatch(html, /accessKey|secretAccessKey/i);
  console.log('Verified: the virtual-production dashboard presents the approved Castle_Set_v12 workflow without exposing credentials or claiming cloud deployment.');
} finally { await rm(root, { recursive: true, force: true }); }
