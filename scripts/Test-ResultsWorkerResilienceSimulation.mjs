import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const outputDirectory = await mkdtemp(join(tmpdir(), 'arthurs-trials-results-resilience-'));

try {
  const { stdout } = await execute(process.execPath, ['scripts/Run-ResultsWorkerResilienceSimulation.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, RESILIENCE_SIM_OUT_DIR: outputDirectory },
  });
  const summary = JSON.parse(stdout);
  const persisted = JSON.parse(await readFile(join(outputDirectory, 'results-worker-resilience-summary.json'), 'utf8'));
  assert.deepEqual(summary.outcomes, ['RETRY', 'PROCESSED', 'RETRY', 'RETRY', 'RETRY', 'EMPTY']);
  assert.equal(summary.transientFailureRecovered, true);
  assert.equal(summary.poisonMessageMovedToDlq, true);
  assert.equal(summary.awardedXp, 125);
  assert.equal(summary.dlqMessageCount, 1);
  assert.match(summary.scope, /does not call AWS/i);
  assert.deepEqual(persisted, summary);
  console.log('Verified: the local SQS-semantics simulation proves a transient worker retry and a poison-message DLQ route without AWS resources.');
} finally {
  await rm(outputDirectory, { recursive: true, force: true });
}
