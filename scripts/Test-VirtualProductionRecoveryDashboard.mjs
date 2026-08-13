import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRecoveryDashboard } from '../virtual-production/src/recovery-dashboard.mjs';

const root = await mkdtemp(join(tmpdir(), 'arthurs-trials-vp-recovery-dashboard-'));
try {
  const workflowPath = join(root, 'workflow.json');
  const rollbackPath = join(root, 'rollback.json');
  const outputPath = join(root, 'dashboard.html');
  await writeFile(workflowPath, JSON.stringify({ versionId: 'Castle_Set_v12' }));
  await writeFile(rollbackPath, JSON.stringify({ currentVersion: 'Castle_Set_v12', recovery: { finalStageVersion: 'Castle_Set_v11', actions: ['Validate prior approved manifest', 'Switch local stage manifest atomically'] }, scope: 'Local deterministic rollback simulation only. No S3 version is deployed.' }));
  await createRecoveryDashboard({ workflowPath, rollbackPath, outputPath });
  const html = await readFile(outputPath, 'utf8');
  assert.match(html, /Castle_Set_v12/);
  assert.match(html, /Castle_Set_v11/);
  assert.match(html, /stage role reads only approved assets/i);
  assert.match(html, /No AWS resources deployed/);
  assert.doesNotMatch(html, /accessKey|secretAccessKey/i);
  console.log('Verified: the VP recovery dashboard presents version rollback and stage-read-only access without claiming a cloud deployment.');
} finally { await rm(root, { recursive: true, force: true }); }
